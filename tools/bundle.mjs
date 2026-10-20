// Empacota a aplicação em dist/index.html (com o worker embutido) ao lado de
// dist/cauchy.wasm. Bundler mínimo para os módulos ES do projeto: cada módulo
// vira uma função cujo retorno são suas exportações.

import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => relative(root, p);

const IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?/g;
const REEXPORT_RE = /export\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?/g;
const EXPORT_LIST_RE = /export\s*\{([^}]*)\};?/g;
const EXPORT_DECL_RE = /export\s+((?:async\s+)?function\*?|class|const|let)\s+([\p{L}_$][\p{L}\p{N}_$]*)/gu;

const names = (list) => list.split(',').map((s) => s.trim()).filter(Boolean);

function bundle(entry) {
  const order = [];
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    for (const re of [IMPORT_RE, REEXPORT_RE]) {
      for (const m of src.matchAll(re)) visit(resolve(dirname(file), m[2]));
    }
    order.push(file);
  };
  visit(resolve(entry));

  const out = ['const __m = {};'];
  for (const file of order) {
    let src = readFileSync(file, 'utf8');
    const exports = [];
    const dep = (spec) => JSON.stringify(rel(resolve(dirname(file), spec)));
    src = src.replace(REEXPORT_RE, (_, list, spec) => {
      const ns = names(list);
      exports.push(...ns.map((n) => n.split(/\s+as\s+/).pop()));
      return `const { ${ns.map((n) => n.replace(/\s+as\s+/, ': ')).join(', ')} } = __m[${dep(spec)}];`;
    });
    src = src.replace(IMPORT_RE, (_, list, spec) => `const { ${names(list).map((n) => n.replace(/\s+as\s+/, ': ')).join(', ')} } = __m[${dep(spec)}];`);
    src = src.replace(EXPORT_LIST_RE, (_, list) => {
      exports.push(...names(list));
      return '';
    });
    src = src.replace(EXPORT_DECL_RE, (_, kind, name) => {
      exports.push(name);
      return `${kind} ${name}`;
    });
    if (/\bexport\b\s+default/.test(src)) throw new Error(`${rel(file)}: export default não suportado`);
    out.push(`// ---- ${rel(file)}\n__m[${JSON.stringify(rel(file))}] = (() => {\n${src}\nreturn { ${[...new Set(exports)].join(', ')} };\n})();`);
  }
  return out.join('\n');
}

const scriptSafe = (s) => s.replace(/<\/(script)/gi, '<\\/$1');

const glue = readFileSync(join(root, 'build/obj/cauchy.mjs'), 'utf8').replace(/export\s+default\s+createCauchy;?\s*$/, '');
const worker = `${glue}\n${bundle(join(root, 'src/js/notebook/worker.js'))}`;
const app = bundle(join(root, 'src/ui/ui.js'));
const css = readFileSync(join(root, 'src/ui/style.css'), 'utf8');
const html = readFileSync(join(root, 'src/ui/index.html'), 'utf8')
  .replace('/*STYLE*/', () => css)
  .replace('/*WORKER*/', () => scriptSafe(worker))
  .replace('/*APP*/', () => scriptSafe(app));

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/index.html'), html);
copyFileSync(join(root, 'build/obj/cauchy.wasm'), join(root, 'dist/cauchy.wasm'));
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`dist/index.html ${kb(html.length)} (worker ${kb(worker.length)}, app ${kb(app.length)})`);
