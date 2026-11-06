// Builds the iPhone app's web folder: native/www/ (ignored by git; the Capacitor project bundles it).
//   cd native && npm ci && cd .. && node tools/build-ios.mjs
// three.js and the two fonts come from native/node_modules (exact versions in native/package.json), so `npm ci` in
// native/ comes first. At the end it runs the gate tools/check-ios-www.mjs and exits with its result.
//
// Same idea as tools/build-web.mjs (copied from there, not imported, so the two builds can differ): index.html is a
// claude.ai artifact body, so it gets a full document head with the same viewport, safe-area padding and theme colors.
// Unlike the web build: no manifest, no service worker, no home-screen meta tags, and nothing comes from the internet.
// three.js (the module and only the addon files the game imports, followed through their own imports) and the fonts
// (woff2, Latin subset, only the weights the page asks for) are copied in, and the page's links to jsDelivr and Google
// Fonts are rewritten to those local files. Each rewrite must match exactly once or the build stops, so a later edit
// to index.html can never quietly put a CDN link inside the app.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const native = path.join(root, 'native');
const mods = path.join(native, 'node_modules');
const out = path.join(native, 'www');

const fail = msg => { console.error(`build-ios: ${msg}`); process.exit(1); };
const rel = p => path.relative(root, p).split(path.sep).join('/');

// The fonts the page asks Google for, and the npm packages that carry the same fonts.
const FONTS = [
  { family: 'DynaPuff', pkg: '@fontsource/dynapuff', id: 'dynapuff', weights: [500, 600, 700] },
  { family: 'M PLUS Rounded 1c', pkg: '@fontsource/m-plus-rounded-1c', id: 'm-plus-rounded-1c', weights: [500, 700, 800] },
];

// ---------- index.html: every rewrite must match exactly once ----------
let page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
function rewrite(what, re, to) {
  const hits = page.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')) || [];
  if (hits.length !== 1) fail(`expected exactly one ${what} in index.html, found ${hits.length}. index.html changed: update tools/build-ios.mjs to match.`);
  const hit = hits[0];
  page = page.replace(hit, typeof to === 'function' ? to(hit) : to);
  return hit;
}

// Fonts: drop the two preconnects, swap the Google stylesheet for the local one (after checking it asks for exactly
// the families and weights bundled here; a new weight on the web must be added to FONTS above, not silently faked).
rewrite('fonts.googleapis.com preconnect', /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com"[^>]*>\n?/, '');
rewrite('fonts.gstatic.com preconnect', /<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com"[^>]*>\n?/, '');
const sheet = rewrite('Google Fonts stylesheet', /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*">/, '<link rel="stylesheet" href="fonts/fonts.css">');
const asked = [...sheet.matchAll(/family=([^:&"]+):wght@([\d;]+)/g)].map(m => `${decodeURIComponent(m[1].replace(/\+/g, ' '))}:${m[2]}`).sort().join(' | ');
const bundled = FONTS.map(f => `${f.family}:${f.weights.join(';')}`).sort().join(' | ');
if (asked !== bundled) fail(`index.html asks Google Fonts for "${asked}" but this build bundles "${bundled}"`);
if (!/display=swap/.test(sheet)) fail('the Google Fonts link no longer asks for display=swap; check the local @font-face rules');

// Import map: three and its addons from the local copy. The version in the map must be the one installed.
const threeUrl = rewrite('import map entry for "three"', /"three": "https:\/\/cdn\.jsdelivr\.net\/npm\/three@[\d.]+\/build\/three\.module\.js"/,
  '"three": "./vendor/three/build/three.module.min.js"');
rewrite('import map entry for "three/addons/"', /"three\/addons\/": "https:\/\/cdn\.jsdelivr\.net\/npm\/three@[\d.]+\/examples\/jsm\/"/,
  '"three/addons/": "./vendor/three/examples/jsm/"');
const wantThree = threeUrl.match(/three@([\d.]+)/)[1];

// ---------- dependencies ----------
const pkgVersion = name => {
  const f = path.join(mods, name, 'package.json');
  if (!fs.existsSync(f)) fail(`${name} is not installed. Run "npm ci" in native/ first.`);
  return JSON.parse(fs.readFileSync(f, 'utf8')).version;
};
const threeVersion = pkgVersion('three');
if (threeVersion !== wantThree) fail(`index.html loads three@${wantThree} but native/node_modules has three@${threeVersion}; pin the same version in native/package.json`);
for (const f of FONTS) pkgVersion(f.pkg);

// ---------- copy the game ----------
fs.rmSync(out, { recursive: true, force: true });
const copied = [];
function copyFile(a, b) { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(a, b); copied.push(b); }
function copyDir(from, to) {
  for (const name of fs.readdirSync(from)) {
    const a = path.join(from, name), b = path.join(to, name);
    if (fs.statSync(a).isDirectory()) copyDir(a, b); else copyFile(a, b);
  }
}
copyDir(path.join(root, 'src'), path.join(out, 'src'));

// ---------- three.js: the module and the addon closure ----------
// The minified module is the same release's official build; the unminified one carries dozens of reference links in
// comments, and the gate allows no links at all. Addon files are copied as they are, except that a link inside a
// comment line is replaced by a note (a link anywhere else stops the build).
const threeDir = path.join(mods, 'three');
copyFile(path.join(threeDir, 'build', 'three.module.min.js'), path.join(out, 'vendor/three/build/three.module.min.js'));
const specifiers = text => [...text.matchAll(/(?:^|[\s;}])(?:import|export)\s[^;]*?\sfrom\s*['"]([^'"]+)['"]|(?:^|[\s;}])import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/gm)]
  .map(m => m[1] || m[2] || m[3]);
const jsFiles = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? jsFiles(path.join(dir, e.name)) : /\.m?js$/.test(e.name) ? [path.join(dir, e.name)] : []);
const addons = new Set();
for (const f of jsFiles(path.join(out, 'src'))) for (const s of specifiers(fs.readFileSync(f, 'utf8'))) if (s.startsWith('three/addons/')) addons.add(s.slice('three/addons/'.length));
const queue = [...addons];
const vendored = [];
while (queue.length) {
  const a = queue.shift();
  const from = path.join(threeDir, 'examples', 'jsm', a);
  if (!fs.existsSync(from)) fail(`addon three/addons/${a} not found in three@${threeVersion}`);
  const lines = fs.readFileSync(from, 'utf8').split('\n').map((line, i) => {
    if (!/https?:\/\//.test(line)) return line;
    if (!/^\s*(\/\/|\/\*|\*)/.test(line)) fail(`three/addons/${a}:${i + 1} has a link outside a comment: ${line.trim()}`);
    return line.replace(/https?:\/\/\S+/g, '(link removed in the offline app build)');
  });
  const to = path.join(out, 'vendor/three/examples/jsm', a);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, lines.join('\n'));
  copied.push(to);
  vendored.push(`three/addons/${a}`);
  for (const s of specifiers(lines.join('\n'))) {
    if (s === 'three') continue;
    let next;
    if (s.startsWith('three/addons/')) next = s.slice('three/addons/'.length);
    else if (s.startsWith('.')) next = path.posix.normalize(path.posix.join(path.posix.dirname(a), s));
    else fail(`three/addons/${a} imports "${s}", which this build does not know how to bundle`);
    if (!addons.has(next)) { addons.add(next); queue.push(next); }
  }
}

// ---------- fonts ----------
const latin = pkg => JSON.parse(fs.readFileSync(path.join(mods, pkg, 'unicode.json'), 'utf8')).latin;
const faces = [];
for (const f of FONTS) {
  const range = latin(f.pkg);
  if (!range) fail(`${f.pkg} has no latin subset`);
  for (const w of f.weights) {
    const file = `${f.id}-latin-${w}-normal.woff2`;
    const from = path.join(mods, f.pkg, 'files', file);
    if (!fs.existsSync(from)) fail(`${f.pkg} has no ${file}`);
    copyFile(from, path.join(out, 'fonts', file));
    faces.push(`@font-face {\n  font-family: '${f.family}';\n  font-style: normal;\n  font-display: swap;\n  font-weight: ${w};\n  src: url(./${file}) format('woff2');\n  unicode-range: ${range};\n}`);
  }
}
const fontVersions = FONTS.map(f => `${f.pkg}@${pkgVersion(f.pkg)}`).join(', ');
fs.writeFileSync(path.join(out, 'fonts', 'fonts.css'),
  `/* Local copies of the fonts the web version loads from Google Fonts (Latin subset, woff2), from ${fontVersions}.\n` +
  `   SIL Open Font License 1.1: native/licenses/. Characters outside the Latin subset (emoji, hearts, arrows) use the\n` +
  `   phone's own fonts. Generated by tools/build-ios.mjs. */\n${faces.join('\n')}\n`);
copied.push(path.join(out, 'fonts', 'fonts.css'));

// ---------- the document ----------
// Head as in tools/build-web.mjs (viewport-fit=cover, safe-area padding, theme colors), minus the manifest, icons and
// home-screen tags; no service worker at the end.
const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#f3e6ee" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#17132e" media="(prefers-color-scheme: dark)">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
`;
const tail = `
</body>
</html>
`;
fs.writeFileSync(path.join(out, 'index.html'), head + page + tail);
copied.push(path.join(out, 'index.html'));

console.log(`Built ${rel(out)}/ (${copied.length} files): three@${threeVersion} (${vendored.length} addon files: ${vendored.join(', ')}), ${fontVersions}`);

// ---------- the gate ----------
const gate = spawnSync(process.execPath, [path.join(root, 'tools', 'check-ios-www.mjs')], { stdio: 'inherit' });
process.exit(gate.status ?? 1);
