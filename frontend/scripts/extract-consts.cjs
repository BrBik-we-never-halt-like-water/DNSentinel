/**
 * Lift constant object literals out of the legacy inline app.js verbatim and emit
 * them as an ES module. Extracting the source text (rather than retyping) keeps the
 * security metadata, explainer copy and record-type colours byte-identical to the
 * shipped app — no transcription drift.
 */
const fs = require('fs');

const SRC = process.env.SPW + '/app.js';
const OUT = process.env.FRONTEND + '/src/constants/legacy.js';
const js = fs.readFileSync(SRC, 'utf8');

// Extract `const NAME = { ... };` by brace matching, ignoring braces inside
// strings/templates so template literals with ${...} don't confuse the counter.
function extract(name) {
  const decl = new RegExp('const\\s+' + name + '\\s*=\\s*\\{');
  const m = decl.exec(js);
  if (!m) throw new Error('constant not found: ' + name);
  const open = js.indexOf('{', m.index);
  let depth = 0;
  let quote = null;
  for (let i = open; i < js.length; i++) {
    const c = js[i];
    const prev = js[i - 1];
    if (quote) {
      if (c === quote && prev !== '\\') quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return js.slice(open, i + 1);
    }
  }
  throw new Error('unbalanced braces for ' + name);
}

const NAMES = ['SEV_RANK', 'SEV_LABEL', 'TAB_CAT', 'CAT_LABEL', 'FINDING_META', 'EXPLAIN', 'TC'];

const header = `/**
 * AUTO-EXTRACTED from the legacy public/index.html inline script.
 *
 * These objects are lifted verbatim so the migrated UI reports exactly the same
 * findings, remediation text, explainer copy and record-type colours as the app
 * they replace. Do not hand-edit: re-run scripts/extract-consts.cjs instead.
 *
 * Extracted: ${NAMES.join(', ')}
 */

`;

const body = NAMES.map((n) => 'export const ' + n + ' = ' + extract(n) + ';\n').join('\n');

fs.mkdirSync(require('path').dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, header + body);

console.log('wrote ' + OUT);
NAMES.forEach((n) => {
  const src = extract(n);
  console.log('  ' + n.padEnd(13) + src.length.toString().padStart(6) + ' chars');
});
