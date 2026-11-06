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
// - Watches the memory limit of the process group (Linux cgroup v2) the test runs in. A test started from inside a
//   service with a memory limit shares that limit with the service: once the group goes over it, the system
//   throttles every process in it, and the browser stalls with all its processes asleep (no frames, page.evaluate
//   never answers, the page's "load" never comes). The test warns at the start when there is little room under the
//   limit, and a failure says so when the system throttled the group during the run.
// - Two switches for the iPhone app's built folder (the tests themselves don't change; setup() reads both from the
//   environment, or from its options): SLIMEKIN_ROOT=<folder> serves that folder instead of the repo (the root option
//   of tools/serve.mjs), and SLIMEKIN_STRICT=1 answers nothing from a local copy: three.js and the font stylesheet are
//   not stood in for, so every request that leaves the test server is aborted, logged and fails the test.
//   Example: SLIMEKIN_ROOT=native/www SLIMEKIN_STRICT=1 node tools/smoke-test.cjs
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

function startServer(root = null) {
  const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve.mjs'), '0', '127.0.0.1', ...(root ? [path.resolve(ROOT, root)] : [])], { stdio: ['ignore', 'pipe', 'pipe'] });
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
// The memory limit of our own process group (Linux cgroup v2), or null where there is none to read.
const MB = 2 ** 20;
function groupMemory() {
  try {
    const rel = fs.readFileSync('/proc/self/cgroup', 'utf8').split('\n').find(l => l.startsWith('0::')).slice(3);
    const dir = path.join('/sys/fs/cgroup', rel);
    const num = f => { const v = fs.readFileSync(path.join(dir, f), 'utf8').trim(); return v === 'max' ? Infinity : +v; };
    const events = Object.fromEntries(fs.readFileSync(path.join(dir, 'memory.events'), 'utf8').trim().split('\n').map(l => l.split(' ')).map(([k, v]) => [k, +v]));
    const limit = Math.min(num('memory.high'), num('memory.max'));
    return { group: rel, high: num('memory.high'), max: num('memory.max'), current: num('memory.current'), limit, throttled: events.high || 0, socketsThrottled: events.sock_throttled || 0 };
  } catch { return null; }
}
const mbs = v => v === Infinity ? 'none' : `${Math.round(v / MB)} MB`;
// The browser test needs about this much memory of its own (Chromium with software WebGL, the page, the server).
const NEEDS = 1024 * MB;
function memoryCheck() {
  const m = groupMemory();
  if (m && m.limit !== Infinity) {
    log(`memory limit of this process group: ${mbs(m.limit)} (high ${mbs(m.high)}, max ${mbs(m.max)}), in use ${mbs(m.current)}`);
    if (m.limit - m.current < NEEDS) log(`WARNING: only ${mbs(Math.max(0, m.limit - m.current))} left under that limit and the browser test needs about ${mbs(NEEDS)}; ` +
      'the system will throttle the browser and the test may stall. Run it outside the limited group (for example from a plain shell, or in its own scope).');
  }
  return m;
}
function memoryNote(start) {
  const m = groupMemory();
  if (!m || !start) return [];
  const more = m.throttled - start.throttled, socks = m.socketsThrottled - start.socketsThrottled;
  if (more <= 0 && socks <= 0) return [`  memory: not throttled during the test (limit ${mbs(m.limit)}, in use ${mbs(m.current)})`];
  return [`  memory: THROTTLED. This process group went over its memory limit ${more} times during the test (limit ${mbs(m.limit)}, ` +
    `in use ${mbs(m.current)}${socks > 0 ? `, network sockets throttled ${socks} times` : ''}). The system slows every process in the group when that ` +
    'happens, so the browser stalls with its processes asleep: this is the machine, not the game. Run the test outside the limited group.'];
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
// else is aborted and logged. Strict: nothing is answered locally, and every aborted request is also a test error.
async function offline(context, origin, aborted, strict = false, errors = null) {
  await context.route(() => true, route => {
    const url = route.request().url();
    if (url.startsWith(origin + '/')) return route.continue();
    if (!strict && url.startsWith(CDN)) return route.fulfill({ path: path.join(THREE, url.slice(CDN.length).split(/[?#]/)[0]), contentType: 'text/javascript' });
    if (!strict && url.startsWith(FONTS)) return route.fulfill({ body: '', contentType: 'text/css' });
    aborted.push(url);
    log('aborted outside request:', url.slice(0, 160));
    if (strict && errors) errors.push('strict offline mode: the page asked for ' + url.slice(0, 160));
    return route.abort('internetdisconnected');
  });
}

// Everything a test needs. Each test step goes through `step(name, fn, ms)`: it is logged, and it fails with a
// diagnosis instead of hanging if it takes longer than `ms`.
async function setup({ contextOptions, root = process.env.SLIMEKIN_ROOT || null, strict = process.env.SLIMEKIN_STRICT === '1' }) {
  const memStart = memoryCheck();
  if (root || strict) log(`serving ${root ? path.resolve(ROOT, root) : 'the repo'}${strict ? '; strict offline mode: nothing is answered from a local copy, every outside request fails the test' : ''}`);
  const server = await startServer(root);
  const { browser, browserLog } = await launch();
  const context = await browser.newContext({ serviceWorkers: 'block', ...contextOptions });
  const aborted = [];
  const errors = [];
  await offline(context, server.origin, aborted, strict, errors);
  const page = await context.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('crash', () => errors.push('the page crashed'));
  let current = 'setup', since = Date.now();
  // what the browser is doing right now, and its last messages (printed when something fails)
  const diagnose = async () => {
    log(`while at: ${current} (for ${((Date.now() - since) / 1000).toFixed(0)} s); browser activity:`);
    for (const line of await browserActivity()) console.log(line);
    for (const line of memoryNote(memStart)) console.log(line);
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
    if (aborted.length || strict) log(`${aborted.length} outside request(s) were aborted (the test runs offline${strict ? '; strict: nothing answered locally' : ''})`);
    const m = groupMemory();
    if (m && memStart && m.throttled > memStart.throttled) log(`note: this process group went over its memory limit ${m.throttled - memStart.throttled} times during the test, which slows the browser`);
  };
  return { server, browser, browserLog, context, page, errors, aborted, step, mark, ev, diagnose, close, report, current: () => current, memStart };
}

// Last resort: if the whole test runs past `minutes`, say where it was, show what the browser was doing, and exit.
function watchdog(minutes, where) {
  const start = groupMemory();
  const t = setTimeout(async () => {
    log(`test still running after ${minutes} min, at step: ${where()}`);
    for (const line of await browserActivity()) console.log(line);
    for (const line of memoryNote(start)) console.log(line);
    console.log('\nFAILED\nwatchdog: the test took too long');
    process.exit(1);   // Playwright stops the browser it launched on exit; the dev server is stopped by its exit hook
  }, minutes * 60000);
  t.unref();
}

module.exports = { setup, watchdog, deadline, log, ROOT };
