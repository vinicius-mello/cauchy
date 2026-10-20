// Gera wrappers C (src/c/bindings.gen.c) e metadados JS
// (src/js/runtime/bindings.gen.js) a partir de src/c/bindings.def.
//
// Formato de cada linha:
//   nome  retorno  arg1 arg2 ...  [= funcao_c]  [! mensagem de erro]
// retorno: tipo de handle (fmpz, arb, fmpz_poly, fmpz_mat@0x1, ...), int, si, ui, d
//   tipos de matriz levam dimensões: @0 (como arg0), @0x1 (linhas de arg0,
//   colunas de arg1), @0T (transposta de arg0), @0r (n×1 com n = linhas de arg0)
// argumentos: tipos de handle, prec, si, ui, str, modctx, fqctx
// "!" indica que a função C devolve int e zero significa falha.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const HANDLE = new Set([
  'fmpz', 'zmod', 'fmpq', 'arb', 'acb', 'fmpz_poly', 'fmpq_poly', 'arb_poly',
  'acb_poly', 'zmod_poly', 'fq', 'fq_poly', 'fmpz_mat', 'fmpq_mat', 'arb_mat',
  'acb_mat', 'zmod_mat', 'fq_mat',
]);
const MAT = new Set(['fmpz_mat', 'fmpq_mat', 'arb_mat', 'acb_mat', 'zmod_mat', 'fq_mat']);
const SCALAR_RET = { int: 'int', si: 'slong', ui: 'ulong', d: 'double' };
const SCALAR_ARG = { prec: 'slong', si: 'slong', ui: 'ulong', str: 'const char *', modctx: 'const void *', fqctx: 'const void *', d: 'double' };

function parseLine(line, lineno) {
  const [main, check] = line.split('!').map((s) => s?.trim());
  const [sig, cfunc] = main.split('=').map((s) => s?.trim());
  const [name, ret, ...args] = sig.split(/\s+/);
  const [retType, dims] = ret.split('@');
  if (!HANDLE.has(retType) && !SCALAR_RET[retType]) throw new Error(`linha ${lineno}: retorno desconhecido ${ret}`);
  for (const a of args) {
    if (!HANDLE.has(a) && !SCALAR_ARG[a]) throw new Error(`linha ${lineno}: argumento desconhecido ${a}`);
  }
  if (MAT.has(retType) && !dims) throw new Error(`linha ${lineno}: matriz sem dimensões`);
  return { name, retType, dims, args, cfunc: cfunc || name, check: check || null };
}

function dimsExpr(dims, args, retType) {
  const ref = (k) => {
    const t = args[k];
    if (!MAT.has(t)) throw new Error(`dimensão refere a argumento não matricial: ${dims}`);
    return t;
  };
  let m;
  if ((m = /^(\d+)$/.exec(dims))) {
    const k = +m[1];
    return [`cy_nrows_${ref(k)}(a${k}, ctx)`, `cy_ncols_${ref(k)}(a${k}, ctx)`];
  }
  if ((m = /^(\d+)x(\d+)$/.exec(dims))) {
    const i = +m[1], j = +m[2];
    return [`cy_nrows_${ref(i)}(a${i}, ctx)`, `cy_ncols_${ref(j)}(a${j}, ctx)`];
  }
  if ((m = /^(\d+)T$/.exec(dims))) {
    const k = +m[1];
    return [`cy_ncols_${ref(k)}(a${k}, ctx)`, `cy_nrows_${ref(k)}(a${k}, ctx)`];
  }
  if ((m = /^(\d+)c$/.exec(dims))) {
    const k = +m[1];
    return [`cy_ncols_${ref(k)}(a${k}, ctx)`, `cy_ncols_${ref(k)}(a${k}, ctx)`];
  }
  throw new Error(`dimensões inválidas: ${dims} (${retType})`);
}

function genC(d) {
  const params = d.args.map((a, k) => {
    if (a === 'modctx' || a === 'fqctx') return 'const void *ctx';
    if (a === 'prec') return 'slong prec';
    return `${SCALAR_ARG[a] ?? 'void *'} a${k}`;
  });
  const hasCtx = d.args.some((a) => a === 'modctx' || a === 'fqctx');
  const callArgs = d.args.map((a, k) => (a === 'modctx' || a === 'fqctx' ? 'ctx' : a === 'prec' ? 'prec' : `a${k}`));
  const sigParams = params.length ? params.join(', ') : 'void';
  const ctxDecl = hasCtx ? '' : '    const void *ctx = NULL; (void) ctx;\n';
  const lines = [];
  lines.push(`EMSCRIPTEN_KEEPALIVE ${SCALAR_RET[d.retType] ?? 'void *'} cy_${d.name}(${sigParams})`);
  lines.push('{');
  if (SCALAR_RET[d.retType]) {
    lines.push(`    return ${d.cfunc}(${callArgs.join(', ')});`);
  } else {
    lines.push(ctxDecl.trimEnd() || null);
    if (MAT.has(d.retType)) {
      const [r, c] = dimsExpr(d.dims, d.args, d.retType);
      lines.push(`    void *r = cy_new_${d.retType}(${r}, ${c}, ctx);`);
    } else {
      lines.push(`    void *r = cy_new_${d.retType}(ctx);`);
    }
    const call = `${d.cfunc}(${['r', ...callArgs].join(', ')})`;
    if (d.check) {
      lines.push(`    if (!${call})`);
      lines.push('    {');
      lines.push(`        cy_free_${d.retType}(r, ctx);`);
      lines.push(`        cy_error(${JSON.stringify(d.check)});`);
      lines.push('    }');
    } else {
      lines.push(`    ${call};`);
    }
    lines.push('    return r;');
  }
  lines.push('}');
  return lines.filter((l) => l !== null).join('\n');
}

const src = readFileSync(join(root, 'src/c/bindings.def'), 'utf8');
const defs = [];
src.split('\n').forEach((raw, i) => {
  const line = raw.replace(/#.*/, '').trim();
  if (line) defs.push(parseLine(line, i + 1));
});

const seen = new Set();
for (const d of defs) {
  if (seen.has(d.name)) throw new Error(`definição duplicada: ${d.name}`);
  seen.add(d.name);
}

const frees = [...HANDLE].map((t) => `void cy_free_${t}(void *p, const void *ctx);`).join('\n');
const c = `// Gerado por tools/gen-bindings.mjs a partir de bindings.def. Não editar.
#include "bridge.h"

${frees}

/* Adaptadores escritos à mão, referenciados em bindings.def. */
#include "helpers.c"

${defs.map(genC).join('\n\n')}
`;
writeFileSync(join(root, 'src/c/bindings.gen.c'), c);

const sig = Object.fromEntries(defs.map((d) => [d.name, [d.dims ? `${d.retType}@${d.dims}` : d.retType, d.args, d.cfunc]]));
const js = `// Gerado por tools/gen-bindings.mjs a partir de bindings.def. Não editar.
export const SIG = ${JSON.stringify(sig, null, 0).replace(/\],"/g, '],\n  "')};
`;
writeFileSync(join(root, 'src/js/runtime/bindings.gen.js'), js);
console.log(`${defs.length} bindings gerados`);
