// Carrega o módulo wasm em node e cria notebooks para testes e REPL.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadFlint } from '../src/js/runtime/flint.js';
import { setFlint } from '../src/js/runtime/rings.js';
import { Notebook } from '../src/js/notebook/notebook.js';
import { toText } from '../src/js/runtime/show.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let F = null;
export async function init() {
  if (F) return F;
  const { default: createCauchy } = await import(join(root, 'build/obj/cauchy.mjs'));
  F = await loadFlint(createCauchy);
  setFlint(F);
  return F;
}

// Avalia uma sequência de células e devolve o texto exibido de cada uma.
export function run(nb, srcs) {
  const changes = srcs.map((src, i) => ({ id: `c${i}`, src }));
  const res = nb.update(changes);
  const byId = new Map(res.map((r) => [r.id, r]));
  return changes.map(({ id }) => {
    const r = byId.get(id);
    if (!r) return null;
    if (r.status === 'error') return `ERRO: ${r.error.message}`;
    return r.display ? toText(r.display) : '';
  });
}

export function evalOne(src) {
  const nb = new Notebook();
  const out = run(nb, [src])[0];
  nb.update([{ id: 'c0', src: null }]);
  return out;
}

export { Notebook, toText };
