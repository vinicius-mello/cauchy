// Acesso de baixo nível ao módulo wasm: chamadas, strings, vetores de
// handles e arenas de memória.

import { SIG } from './bindings.gen.js';

export class FlintError extends Error {
  get name() {
    return 'FlintError';
  }
}

const HANDLE_ARGS = new Set([
  'fmpz', 'zmod', 'fmpq', 'arb', 'acb', 'fmpz_poly', 'fmpq_poly', 'arb_poly',
  'acb_poly', 'zmod_poly', 'fq', 'fq_poly', 'fmpz_mat', 'fmpq_mat', 'arb_mat',
  'acb_mat', 'zmod_mat', 'fq_mat', 'fmpz_mpoly', 'fmpq_mpoly', 'zmod_mpoly',
]);

export class Flint {
  constructor(M) {
    this.M = M;
    this.prec = 128;
    // Arena corrente: handles criados são registrados aqui para liberação.
    this.arena = null;
    this.live = 0;
  }

  // Chama cy_<name> com tratamento de erro e restauração da pilha.
  raw(name, ...args) {
    const f = this.M['_cy_' + name];
    if (!f) throw new Error(`função wasm inexistente: cy_${name}`);
    const sp = this.M.stackSave();
    try {
      return f(...args);
    } catch (e) {
      this.M.stackRestore(sp);
      if (e instanceof FlintError) throw new FlintError(cleanMessage(e.message));
      if (e instanceof WebAssembly.RuntimeError) {
        this.poisoned = true;
        throw new FlintError(`erro interno no wasm: ${e.message}`);
      }
      throw e;
    }
  }

  // Chama uma operação descrita em bindings.def. `args` contém ponteiros,
  // números ou strings; prec e ctx são preenchidos automaticamente.
  // Devolve um ponteiro (para retornos de handle) ou número.
  sig(name, ctx, args) {
    const s = SIG[name];
    if (!s) throw new Error(`binding inexistente: ${name}`);
    const [, types] = s;
    const call = [];
    const temps = [];
    let k = 0;
    for (const t of types) {
      if (t === 'prec') call.push(this.prec);
      else if (t === 'modctx' || t === 'fqctx' || t === 'mctx') call.push(ctx);
      else if (t === 'str') {
        const p = this.M.stringToNewUTF8(String(args[k++]));
        temps.push(p);
        call.push(p);
      } else call.push(args[k++]);
    }
    if (k !== args.length) throw new Error(`${name}: esperava ${k} argumentos, recebeu ${args.length}`);
    try {
      return this.raw(name, ...call);
    } finally {
      for (const p of temps) this.M._free(p);
    }
  }

  retType(name) {
    return SIG[name]?.[0].split('@')[0];
  }

  signatures() {
    return SIG;
  }

  has(name) {
    return name in SIG;
  }

  // Lê e libera uma string C.
  str(p) {
    const s = this.M.UTF8ToString(p);
    this.M._cy_free_str(p);
    return s;
  }

  // Passa uma string JS para uma função C, liberando-a depois.
  withCStr(s, fn) {
    const p = this.M.stringToNewUTF8(s);
    try {
      return fn(p);
    } finally {
      this.M._free(p);
    }
  }

  // Lê um vetor [len, x0, ...] devolvido pela ponte e o libera.
  vec(p) {
    const base = p >> 2;
    const n = this.M.HEAP32[base];
    const out = [];
    for (let i = 0; i < n; i++) out.push(this.M.HEAPU32[base + 1 + i]);
    this.M._cy_vec_free(p);
    return out;
  }

  track(elem) {
    this.live++;
    if (this.arena) this.arena.push(elem);
  }

  release(elem) {
    if (elem.ptr === 0) return;
    this.M['_cy_free_' + elem.ring.tag](elem.ptr, elem.ring.ctx);
    elem.ptr = 0;
    this.live--;
  }

  // Executa fn com uma arena nova; devolve {value, arena}.
  inArena(fn) {
    const saved = this.arena;
    const arena = [];
    this.arena = arena;
    try {
      return { value: fn(), arena };
    } catch (e) {
      e.arena = arena;
      throw e;
    } finally {
      this.arena = saved;
    }
  }

  withPrec(prec, fn) {
    const saved = this.prec;
    this.prec = prec;
    try {
      return fn();
    } finally {
      this.prec = saved;
    }
  }

  version() {
    return this.str(this.M._cy_version());
  }
}

function cleanMessage(msg) {
  return msg.replace(/^Exception \(([^)]*)\)\.\s*/, '$1: ').trim();
}

export function isHandleType(t) {
  return HANDLE_ARGS.has(t);
}

export async function loadFlint(createModule, opts = {}) {
  const M = await createModule({ FlintError, ...opts });
  M._cy_init();
  return new Flint(M);
}
