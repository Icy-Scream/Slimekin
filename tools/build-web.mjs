// Builds the installable web app (for GitHub Pages) into docs/.
//   node tools/build-web.mjs                       (the live app: docs/)
//   node tools/build-web.mjs tools/out/web-test    (a test build into another folder; --version=ID sets its VERSION)
// index.html is written as a claude.ai artifact body, so this wraps it in a full document
// and adds what a home-screen app needs: manifest, icons, iPhone meta tags and an offline cache.
// The Greenhouse room's files (src/assets/greenhouse/, about 3.4 MB) get their own offline cache named by a hash of
// their contents, so a release that does not change the room does not make every phone download it again.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const outArg = args.find(a => !a.startsWith('--'));
const out = outArg ? path.resolve(outArg) : path.join(root, 'docs');
const version = (args.find(a => a.startsWith('--version=')) || '').slice(10) || new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
if (out === root || root.startsWith(out + path.sep)) throw new Error(`refusing to build into ${out}`);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

// Copy game sources and icons.
const files = [];
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    const a = path.join(from, name), b = path.join(to, name);
    if (fs.statSync(a).isDirectory()) copyDir(a, b);
    else { fs.copyFileSync(a, b); files.push(path.relative(out, b).split(path.sep).join('/')); }
  }
}
copyDir(path.join(root, 'src'), path.join(out, 'src'));
copyDir(path.join(root, 'web', 'icons'), path.join(out, 'icons'));
// The App Store pages (privacy, support) are plain pages next to the game; not part of the offline cache.
for (const name of fs.readdirSync(path.join(root, 'web', 'pages'))) fs.copyFileSync(path.join(root, 'web', 'pages', name), path.join(out, name));

const body = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#f3e6ee" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#17132e" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Slimekin">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
`;
const tail = `
<script>
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(out, 'index.html'), head + body + tail);

fs.writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify({
  name: 'Slimekin',
  short_name: 'Slimekin',
  description: 'Raise a tiny slime. Boop it, feed it, pet it, and watch it grow.',
  start_url: './',
  scope: './',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#f3e6ee',
  theme_color: '#f3e6ee',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2));

// the room's files: their own cache, named by their contents
const isRoom = f => f.startsWith('src/assets/greenhouse/');
const room = files.filter(isRoom).sort();
const hash = crypto.createHash('sha256');
for (const f of room) { hash.update(f + '\0'); hash.update(fs.readFileSync(path.join(out, f))); }
const roomHash = hash.digest('hex').slice(0, 16);

const core = ['./', 'index.html', 'manifest.webmanifest', ...files.filter(f => !isRoom(f))];
fs.writeFileSync(path.join(out, 'sw.js'), fs.readFileSync(path.join(root, 'web', 'sw.js'), 'utf8')
  .replace('__VERSION__', version)
  .replace('__CORE__', JSON.stringify(core))
  .replace('__ROOMHASH__', roomHash)
  .replace('__ROOM__', JSON.stringify(room)));
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log(`Built ${path.relative(root, out) || out} (version ${version}, ${core.length} cached files; room cache ${roomHash}, ${room.length} files)`);
