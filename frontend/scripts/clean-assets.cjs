/**
 * Empty ../public/assets before a build.
 *
 * The build runs with `emptyOutDir: false` because it writes into public/, which also
 * holds files it must never delete (shared/health-score.js, docs.html, legacy.html,
 * sw.js, icon.svg, manifest.webmanifest, robots.txt, sitemap.xml, logo.png). The
 * side effect is that hashed bundles from previous builds pile up in public/assets/
 * forever. This clears just that one directory, which only ever contains build output.
 */
const fs = require('fs');
const path = require('path');

const assets = path.join(__dirname, '..', '..', 'public', 'assets');

if (!fs.existsSync(assets)) process.exit(0);

let removed = 0;
for (const name of fs.readdirSync(assets)) {
  fs.rmSync(path.join(assets, name), { recursive: true, force: true });
  removed++;
}
console.log(`clean-assets: removed ${removed} file(s) from public/assets`);
