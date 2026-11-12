// Gate for the iPhone app's web folder (native/www/, made by tools/build-ios.mjs, which runs this at its end).
//   node tools/check-ios-www.mjs [folder]          (default native/www)
// Fails (exit 1) unless:
//   1. no text file has an http:// or https:// link, apart from the XML namespace names listed in ALLOWED below
//      (identifiers that are never fetched), and no protocol-relative link (src="//...", url(//...));
//   2. the game's own code (index.html and src/) uses no network API (fetch, XMLHttpRequest, WebSocket, ...), apart
//      from the local reads listed in LOCAL_READS below (a file of the app's own, by a URL relative to the module);
//   3. every import map target, script, stylesheet and font file the page names exists;
//   4. every import in every JavaScript file resolves to a file in the folder (through the import map for "three").
// Then prints the file count and total size.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const www = path.resolve(process.argv[2] || path.join(root, 'native', 'www'));
if (!fs.existsSync(path.join(www, 'index.html'))) { console.error(`check-ios-www: no index.html in ${www} (run node tools/build-ios.mjs)`); process.exit(1); }

// The only links allowed anywhere: XML namespace names. A browser never requests these; they only say which kind of
// element is meant. `files` limits where each one may appear.
const ALLOWED = [
  { url: 'http://www.w3.org/2000/svg', files: /^(index\.html|src\/.+\.js)$/, why: 'SVG namespace (xmlns) of the inline SVG drawings' },
  { url: 'http://www.w3.org/1999/xlink', files: /^(index\.html|src\/.+\.js)$/, why: 'XLink namespace of inline SVG drawings' },
  { url: 'http://www.w3.org/1999/xhtml', files: /^vendor\/three\/build\/three\.module\.min\.js$/, why: 'XHTML namespace three.js passes to document.createElementNS' },
];
// The game's own code must not use any of these (three.js has loaders that do, but the game never calls them).
const NETWORK_APIS = /\b(fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|window\.open\s*\(|importScripts|navigator\.serviceWorker)|target\s*=\s*["']_blank/g;
// The game's own reads of files inside the app (no host: a URL relative to the module, into a folder of the app). Each
// one must look exactly like this (the base line, `n` calls of exactly that form, nothing else) and its folder must be
// in the app with files in it; any other fetch in the game code fails the gate as before.
const LOCAL_READS = [
  { file: 'src/view/greenhouse.js', folder: 'src/assets/greenhouse', n: 1,
    base: /^const BASE = new URL\('\.\.\/assets\/greenhouse\/', import\.meta\.url\);$/m, call: /\bfetch\(new URL\(name, BASE\)\)/g,
    why: "the Greenhouse room's own files (gh.json, gh.bin), bundled in the app" },
  { file: 'src/view/barn.js', folder: 'src/assets/barn', n: 1,
    base: /^const BASE = new URL\('\.\.\/assets\/barn\/', import\.meta\.url\);$/m, call: /\bfetch\(new URL\(name, BASE\)\)/g,
    why: "the Barn ranch's own files (barn.json, barn.bin), bundled in the app" },
  { file: 'src/view/race-kit.js', folder: 'src/assets/race', n: 1,
    base: /^const BASE = new URL\('\.\.\/assets\/race\/', import\.meta\.url\);$/m, call: /\bfetch\(new URL\(name, BASE\)\)/g,
    why: "the race's pixel kit (usopp/race-kit: sheets, tiles, anchors), bundled in the app" },
];
const BINARY = new Set(['.woff2', '.woff', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bin']);

const problems = [];
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p); else files.push(p);
  }
})(www);
const rel = p => path.relative(www, p).split(path.sep).join('/');
const lineOf = (text, i) => text.slice(0, i).split('\n').length;

// ---------- 1 and 2: links and network APIs ----------
const allowedSeen = new Map();
const localSeen = [];
let textFiles = 0;
for (const f of files) {
  if (BINARY.has(path.extname(f).toLowerCase())) continue;
  textFiles++;
  const r = rel(f), text = fs.readFileSync(f, 'utf8');
  for (const m of text.matchAll(/https?:\/\/[^\s"'`<>()\\]*/gi)) {
    const ok = ALLOWED.find(a => m[0] === a.url && a.files.test(r));
    if (ok) allowedSeen.set(`${ok.url} in ${r}`, (allowedSeen.get(`${ok.url} in ${r}`) || 0) + 1);
    else problems.push(`${r}:${lineOf(text, m.index)}: link ${m[0].slice(0, 120)}`);
  }
  for (const m of text.matchAll(/(?:\b(?:src|href|action)\s*=\s*["']|url\(\s*["']?|\bfrom\s*["']|import\s*\(?\s*["'])\/\/[^"')\s]+/gi)) problems.push(`${r}:${lineOf(text, m.index)}: protocol-relative link ${m[0].slice(0, 120)}`);
  if (r === 'index.html' || r.startsWith('src/')) {
    const local = LOCAL_READS.find(l => l.file === r);
    const hits = [...text.matchAll(NETWORK_APIS)];
    const calls = local ? [...text.matchAll(local.call)].length : 0;
    const fetches = hits.filter(m => /^fetch/.test(m[0])).length;
    const dir = local && path.join(www, local.folder);
    const folderFiles = dir && fs.existsSync(dir) ? fs.readdirSync(dir).filter(n => fs.statSync(path.join(dir, n)).isFile()) : [];
    const ok = local && local.base.test(text) && calls === local.n && fetches === local.n && folderFiles.length > 0;
    if (ok) localSeen.push(`${r} reads ${local.folder}/ (${folderFiles.length} files, ${(folderFiles.reduce((b, n) => b + fs.statSync(path.join(dir, n)).size, 0) / 1024).toFixed(1)} KB): ${local.why}`);
    for (const m of hits) if (!(ok && /^fetch/.test(m[0]))) problems.push(`${r}:${lineOf(text, m.index)}: network API ${m[0]}`);
    if (local && !ok && fetches) problems.push(`${r}: its local reads changed (expected ${local.n} x fetch(new URL(name, BASE)) into ${local.folder}/, which must be in the app): update LOCAL_READS in tools/check-ios-www.mjs only if they still read files of the app`);
  }
}

// ---------- 3: what the page names ----------
const page = fs.readFileSync(path.join(www, 'index.html'), 'utf8');
const mapTag = [...page.matchAll(/<script type="importmap">([\s\S]*?)<\/script>/g)];
let imports = {};
if (mapTag.length !== 1) problems.push(`index.html: expected one import map, found ${mapTag.length}`);
else {
  try { imports = JSON.parse(mapTag[0][1]).imports || {}; } catch (e) { problems.push(`index.html: import map is not valid JSON (${e.message})`); }
}
const local = (from, ref) => path.resolve(path.dirname(from), ref.split(/[?#]/)[0]);
const exists = p => p.startsWith(www + path.sep) && fs.existsSync(p);
const named = [];
for (const [k, v] of Object.entries(imports)) {
  if (!/^\.\.?\//.test(v)) { problems.push(`import map "${k}" -> ${v}: not a local path`); continue; }
  const p = local(path.join(www, 'index.html'), v);
  if (!(exists(p) && (v.endsWith('/') ? fs.statSync(p).isDirectory() : fs.statSync(p).isFile()))) problems.push(`import map "${k}" -> ${v}: missing`);
  named.push(`import map ${k}`);
}
for (const m of page.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)) {
  if (!exists(local(path.join(www, 'index.html'), m[1]))) problems.push(`index.html names ${m[1]}: missing`);
  named.push(m[1]);
}
for (const css of files.filter(f => f.endsWith('.css'))) {
  const text = fs.readFileSync(css, 'utf8');
  for (const m of text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    if (m[1].startsWith('data:')) continue;
    if (!exists(local(css, m[1]))) problems.push(`${rel(css)} names ${m[1]}: missing`);
    named.push(`${rel(css)} -> ${m[1]}`);
  }
}

// ---------- 4: every import resolves ----------
// Readable modules: `import ... from '...'`, `export ... from '...'`, `import '...'`, `import('...')`. The minified
// three.js module is checked with a compact pattern (it is one long line with no spaces around keywords).
const specs = (text, compact) => compact
  ? [...text.matchAll(/\b(?:import|export)\s*(?:[\w*{}\s,$]*?\s*from\s*)?["']([^"']+)["']/g)].map(m => m[1])
  : [...text.matchAll(/(?:^|[\s;}])(?:import|export)\s[^;]*?\sfrom\s*['"]([^'"]+)['"]|(?:^|[\s;}])import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/gm)].map(m => m[1] || m[2] || m[3]);
let importCount = 0;
for (const f of files.filter(f => /\.m?js$/.test(f))) {
  const text = fs.readFileSync(f, 'utf8');
  for (const s of specs(text, f.endsWith('.min.js'))) {
    importCount++;
    let target = null;
    if (/^\.\.?\//.test(s)) target = local(f, s);
    else if (imports[s]) target = local(path.join(www, 'index.html'), imports[s]);
    else {
      const prefix = Object.keys(imports).filter(k => k.endsWith('/') && s.startsWith(k)).sort((a, b) => b.length - a.length)[0];
      if (prefix) target = local(path.join(www, 'index.html'), imports[prefix] + s.slice(prefix.length));
    }
    if (!target) problems.push(`${rel(f)}: import "${s}" is not a relative path and not in the import map`);
    else if (!exists(target) || !fs.statSync(target).isFile()) problems.push(`${rel(f)}: import "${s}" -> ${rel(target)}: missing`);
  }
}

// ---------- report ----------
const size = files.reduce((s, f) => s + fs.statSync(f).size, 0);
const by = {};
for (const f of files) { const top = rel(f).split('/')[0]; const k = top.includes('.') ? '(top level)' : top + '/'; by[k] = by[k] || { n: 0, b: 0 }; by[k].n++; by[k].b += fs.statSync(f).size; }
const kb = b => `${(b / 1024).toFixed(1)} KB`;
console.log(`check-ios-www: ${path.relative(root, www) || www}`);
console.log(`  ${files.length} files (${textFiles} text), ${kb(size)} total: ` + Object.entries(by).map(([k, v]) => `${k} ${v.n} files ${kb(v.b)}`).join(', '));
console.log(`  ${importCount} import statements resolved, ${named.length} page references checked`);
for (const [k, n] of allowedSeen) console.log(`  allowed namespace name: ${k} (${n}x)`);
for (const l of localSeen) console.log(`  allowed local read: ${l}`);
if (problems.length) {
  console.log(`\nFAILED: ${problems.length} problem(s)\n` + problems.map(p => '  ' + p).join('\n'));
  process.exit(1);
}
console.log(`  OK: no links, no network APIs in the game code${localSeen.length ? ' (only reads of its own files)' : ''}, every file named and imported is there`);
