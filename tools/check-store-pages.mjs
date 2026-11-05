// For the day before App Store submission only (not part of the normal web ship; the family's updates go out without
// it): fails while the store pages in web/pages/ still have {{PLACEHOLDERS}} (contact email, date) to fill in.
//   node tools/check-store-pages.mjs
// Also fails if a page loads anything from another site (the pages promise that the app talks to nothing; they
// should not either). Links the reader taps (mailto:, the pages' own names) are fine.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'web', 'pages');
const problems = [];
const pages = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
for (const f of pages) {
  const text = fs.readFileSync(path.join(dir, f), 'utf8');
  const lineOf = i => text.slice(0, i).split('\n').length;
  for (const m of text.matchAll(/\{\{\s*([A-Z_]+)\s*\}\}/g)) problems.push(`${f}:${lineOf(m.index)}: fill in {{${m[1]}}}`);
  for (const m of text.matchAll(/\b(?:src|href)\s*=\s*["']((?:https?:)?\/\/[^"']+)["']|url\(\s*["']?((?:https?:)?\/\/[^)"']+)/gi)) problems.push(`${f}:${lineOf(m.index)}: loads or links to another site: ${m[1] || m[2]}`);
  if (!/^<!-- REVISE BEFORE SUBMISSION/.test(text)) problems.push(`${f}: the first line should be the "REVISE BEFORE SUBMISSION" reminder`);
}
console.log(`check-store-pages: ${pages.length} page(s) in web/pages: ${pages.join(', ')}`);
console.log('  reminder: each page describes the app with no purchases and no ads. If either was added, rewrite the pages first.');
if (problems.length) { console.log(`\nNOT READY: ${problems.length} thing(s) to fix\n` + problems.map(p => '  ' + p).join('\n')); process.exit(1); }
console.log('  OK: no placeholders left, nothing loaded from other sites. Rebuild docs/ (node tools/build-web.mjs) to publish them.');
