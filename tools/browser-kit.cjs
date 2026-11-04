// Shared setup for the headless browser tests (tools/smoke-test.cjs, tools/breeding-smoke.cjs).
//
// - Starts tools/serve.mjs on a free loopback port (port 0, the server prints the real one) and waits until it
//   is really listening, so a test can never talk to an old server left on a fixed port by another run.
// - Launches Chromium with software WebGL (SwiftShader), fully offline: three.js is served from node_modules,
//   the Google Fonts stylesheet is answered with an empty one, every other request that is not for the test
//   server is aborted and logged, and host names other than 127.0.0.1 don't resolve (that also covers browser
//   connections no route sees, like <link rel=preconnect>). Outside network can never stall a test.
// - Gives every step a deadline (page.evaluate has none of its own), prints timestamped progress, and when a
//   step runs out of time prints what the browser was doing (Linux: CPU of its GPU and page processes, read from
//   /proc for our own browser only) and the last browser log lines, then fails instead of hanging.
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const THREE = path.resolve(path.dirname(require.resolve('three')), '..');   // three/build/three.cjs -> package folder
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.170.0/';
const FONTS = 'https://fonts.googleapis.com/';
const T0 = Date.now();
const stamp = () => `[${((Date.now() - T0) / 1000).toFixed(1).padStart(6)}s]`;
const log = (...a) => console.log(stamp(), ...a);

// Rejects if `promise` doesn't settle in `ms` (the promise itself keeps going; the caller fails and cleans up).
function deadline(promise, ms, what) {
  let timer;
  const late = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${what}: no answer in ${Math.round(ms / 1000)} s`)), ms); });
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}

function startServer() {
  const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve.mjs'), '0', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
  process.on('exit', () => server.kill());
  let out = '';
  return deadline(new Promise((resolve, reject) => {
    server.stdout.on('data', d => {
      out += d;
      const m = out.match(/running at http:\/\/[^:]+:(\d+)/);
      if (m) resolve({ port: +m[1], origin: `http://127.0.0.1:${m[1]}`, stop: () => server.kill() });
    });
    server.stderr.on('data', d => { out += d; });
    server.on('exit', code => reject(new Error(`dev server exited (${code}) before listening: ${out.trim().slice(-300)}`)));
  }), 15000, 'starting the dev server');
}

// Our own browser's processes (Linux only): children of this node process.
function ownProcesses() {
  if (!fs.existsSync('/proc/self/stat')) return [];
  const all = [];
  for (const d of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(d)) continue;
    try {
      const s = fs.readFileSync(`/proc/${d}/stat`, 'utf8');
      all.push({ pid: d, ppid: s.slice(s.lastIndexOf(')') + 2).split(' ')[1], cmd: fs.readFileSync(`/proc/${d}/cmdline`, 'utf8').replace(/\0/g, ' ') });
    } catch { /* gone */ }
  }
  const mine = [], queue = [String(process.pid)];
  while (queue.length) { const p = queue.pop(); for (const x of all) if (x.ppid === p) { mine.push(x); queue.push(x.pid); } }
  return mine;
}
function threadTicks(pid) {
  const r = {};
  try {
    for (const t of fs.readdirSync(`/proc/${pid}/task`)) {
      try {
        const s = fs.readFileSync(`/proc/${pid}/task/${t}/stat`, 'utf8'), f = s.slice(s.lastIndexOf(')') + 2).split(' ');
        r[t] = { name: s.slice(s.indexOf('(') + 1, s.lastIndexOf(')')), state: f[0], ticks: +f[11] + +f[12] };
      } catch { /* thread ended */ }
    }
  } catch { /* process ended */ }
  return r;
}
// Two seconds of CPU use of our browser's GPU process and page (renderer) processes: tells a slow GPU
// (busy threads) from a stuck one (everything asleep).
async function browserActivity() {
  const procs = ownProcesses().filter(p => /--type=(gpu-process|renderer)\b/.test(p.cmd));
  if (!procs.length) return ['  (no per-process view on this system)'];
  const before = procs.map(p => threadTicks(p.pid));
  await new Promise(r => setTimeout(r, 2000));
  return procs.map((p, i) => {
    const now = threadTicks(p.pid);
    const rows = Object.entries(now).map(([t, v]) => ({ t, ...v, pct: (v.ticks - (before[i][t]?.ticks ?? v.ticks)) / 100 / 2 * 100 }));
    const total = rows.reduce((s, r) => s + r.pct, 0), main = rows.find(r => r.t === p.pid);
    const busy = rows.filter(r => r.pct >= 1).sort((a, b) => b.pct - a.pct).slice(0, 5).map(r => `${r.name} ${r.pct.toFixed(0)}%`).join(', ');
    return `  ${p.cmd.match(/--type=([a-z-]+)/)[1]} ${p.pid}: ${total.toFixed(0)}% CPU, main thread ${main ? main.state : '?'} ${main ? main.pct.toFixed(0) : '?'}%${busy ? '; busiest: ' + busy : ''}`;
  });
}

async function launch() {
  const browserLog = [];
  const browser = await chromium.launch({
    // software WebGL so it runs on machines without a GPU (slow, a few frames a second)
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
      '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'],
    logger: { isEnabled: name => name === 'browser', log: (name, sev, msg) => { browserLog.push(String(msg)); if (browserLog.length > 60) browserLog.shift(); } },
  });
  return { browser, browserLog };
}

// Routes for a context: the test server passes, three.js and the font stylesheet are answered locally, anything
// else is aborted and logged.
async function offline(context, origin, aborted) {
  await context.route(() => true, route => {
    const url = route.request().url();
    if (url.startsWith(origin + '/')) return route.continue();
    if (url.startsWith(CDN)) return route.fulfill({ path: path.join(THREE, url.slice(CDN.length).split(/[?#]/)[0]), contentType: 'text/javascript' });
    if (url.startsWith(FONTS)) return route.fulfill({ body: '', contentType: 'text/css' });
    aborted.push(url);
    log('aborted outside request:', url.slice(0, 160));
    return route.abort('internetdisconnected');
  });
}

// Everything a test needs. Each test step goes through `step(name, fn, ms)`: it is logged, and it fails with a
// diagnosis instead of hanging if it takes longer than `ms`.
async function setup({ contextOptions }) {
  const server = await startServer();
  const { browser, browserLog } = await launch();
  const context = await browser.newContext({ serviceWorkers: 'block', ...contextOptions });
  const aborted = [];
  await offline(context, server.origin, aborted);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('crash', () => errors.push('the page crashed'));
  let current = 'setup', since = Date.now();
  // what the browser is doing right now, and its last messages (printed when something fails)
  const diagnose = async () => {
    log(`while at: ${current} (for ${((Date.now() - since) / 1000).toFixed(0)} s); browser activity:`);
    for (const line of await browserActivity()) console.log(line);
    const tail = browserLog.filter(l => /\[err\]/.test(l) && !/dbus|Fontconfig/i.test(l)).slice(-8);
    if (tail.length) console.log('  last browser messages:\n' + tail.map(l => '    ' + l.slice(0, 220)).join('\n'));
  };
  const mark = name => { current = name; since = Date.now(); };
  const step = async (name, fn, ms = 120000) => {
    mark(name);
    const t = Date.now();
    try {
      const r = await deadline(Promise.resolve().then(fn), ms, name);
      if (Date.now() - t > 20000) log(`(slow step: ${name} took ${((Date.now() - t) / 1000).toFixed(0)} s)`);
      return r;
    } catch (e) {
      log(`step failed: ${name} (after ${((Date.now() - t) / 1000).toFixed(0)} s): ${e.message.split('\n')[0]}`);
      if (!e.diagnosed) { e.diagnosed = true; await diagnose(); }
      throw e;
    }
  };
  // page.evaluate with a deadline
  const ev = (fn, arg, ms = 180000) => deadline(page.evaluate(fn, arg), ms, 'page.evaluate');
  const close = async () => {
    await deadline(browser.close(), 30000, 'closing the browser').catch(e => {
      log(e.message, '- stopping it');
      for (const p of ownProcesses()) if (/chrom/.test(p.cmd)) try { process.kill(+p.pid, 'SIGKILL'); } catch { /* gone */ }
    });
    server.stop();
  };
  const report = () => {
    if (aborted.length) log(`${aborted.length} outside request(s) were aborted (the test runs offline)`);
  };
  return { server, browser, browserLog, context, page, errors, aborted, step, mark, ev, diagnose, close, report, current: () => current };
}

// Last resort: if the whole test runs past `minutes`, say where it was, show what the browser was doing, and exit.
function watchdog(minutes, where) {
  const t = setTimeout(async () => {
    log(`test still running after ${minutes} min, at step: ${where()}`);
    for (const line of await browserActivity()) console.log(line);
    console.log('\nFAILED\nwatchdog: the test took too long');
    process.exit(1);   // Playwright stops the browser it launched on exit; the dev server is stopped by its exit hook
  }, minutes * 60000);
  t.unref();
}

module.exports = { setup, watchdog, deadline, log, ROOT };
