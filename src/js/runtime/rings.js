// Anéis e elementos sobre a FLINT: ZZ, QQ, RR (arb), CC (acb), Z/nZ, GF(q),
// anéis de polinômios R[x] e R[x, y, ...] e espaços de matrizes Mat(R). Inclui coerção para
// um anel comum e as operações aritméticas da linguagem.

import { fail } from './errors.js';

let F = null;

export function setFlint(flint) {
  F = flint;
}

export function flint() {
  return F;
}

export class Elem {
  constructor(ring, ptr) {
    this.ring = ring;
    this.ptr = ptr;
    F.track(this);
  }
}

const unwrap = (a) => (a instanceof Elem ? a.ptr : a);

const SCALAR_RET = new Set(['int', 'si', 'ui', 'd']);

// ------------------------------------------------------------------ anéis

const cache = new Map();
function intern(key, make) {
  let r = cache.get(key);
  if (!r) {
    r = make();
    r.key = key;
    cache.set(key, r);
  }
  return r;
}

export class Ring {
  constructor(tag, ctx = 0) {
    this.tag = tag;
    this.ctx = ctx;
  }

  wrap(ptr) {
    return new Elem(this, ptr);
  }

  // Chama um binding; o resultado de handle é embrulhado em `out` (padrão:
  // este anel se o tipo coincide, senão o anel numérico padrão do tipo).
  call(name, args, out) {
    const r = F.sig(name, this.ctx, args.map(unwrap));
    const t = F.retType(name);
    if (SCALAR_RET.has(t)) return t === 'ui' ? r >>> 0 : r;
    const ring = out ?? (t === this.tag ? this : this.base && t === this.base.tag ? this.base : STD_BY_TAG[t]?.());
    if (!ring) throw new Error(`${name}: anel do resultado indeterminado`);
    return ring.wrap(r);
  }

  op(name, ...args) {
    return this.call(name, args);
  }

  opTo(out, name, ...args) {
    return this.call(name, args, out);
  }

  has(op) {
    return F.has(`${this.tag}_${op}`);
  }

  add(a, b) { return this.op(`${this.tag}_add`, a, b); }
  sub(a, b) { return this.op(`${this.tag}_sub`, a, b); }
  mul(a, b) { return this.op(`${this.tag}_mul`, a, b); }
  neg(a) { return this.op(`${this.tag}_neg`, a); }
  eq(a, b) { return this.op(`${this.tag}_equal`, a, b) !== 0; }
  copy(a) { return this.op(`${this.tag}_set`, a); }

  accepts(S) { return S === this; }
  coerce(x) {
    if (x.ring === this) return x;
    fail(`não é possível converter ${x.ring} em ${this}`);
  }

  zero() { return this.fromInt(0); }
  one() { return this.fromInt(1); }
  fromInt(n) { return this.coerce(ZZ.fromInt(n)); }
  isField() { return false; }
  toString() { return this.name; }
}

class IntegerRing extends Ring {
  constructor() { super('fmpz'); this.name = 'ZZ'; this.level = 0; }

  fromInt(n) {
    if (typeof n === 'number' && Number.isInteger(n) && Math.abs(n) < 2 ** 31) {
      return this.wrap(F.raw('fmpz_from_si', n));
    }
    return this.fromString(typeof n === 'number' ? BigInt(Math.trunc(n)).toString() : String(n));
  }

  fromString(s, base = 10) {
    return this.wrap(F.withCStr(s, (p) => F.raw('fmpz_from_str', p, base)));
  }

  toStr(x, base = 10) { return F.str(F.raw('fmpz_get_str', x.ptr, base)); }

  // Número JS se cabe em 32 bits com sinal; senão null.
  toSmall(x) {
    const sp = F.M._malloc(4);
    try {
      return F.raw('fmpz_get_si_checked', x.ptr, sp) ? F.M.HEAP32[sp >> 2] : null;
    } finally {
      F.M._free(sp);
    }
  }

  toNumber(x) { return F.raw('fmpz_get_d', x.ptr); }
  cmp(a, b) { return this.op('fmpz_cmp', a, b); }
  sgn(a) { return this.op('fmpz_sgn', a); }
  isZero(a) { return this.op('fmpz_is_zero', a) !== 0; }
  accepts(S) { return S === this; }
}

class RationalField extends Ring {
  constructor() { super('fmpq'); this.name = 'QQ'; this.level = 1; }
  accepts(S) { return S === this || S === ZZ; }
  coerce(x) {
    if (x.ring === this) return x;
    if (x.ring === ZZ) return this.op('fmpq_set_fmpz', x);
    return super.coerce(x);
  }
  frac(num, den) { return this.wrap(F.raw('fmpq_from_fmpz2', num.ptr, den.ptr)); }
  fromDecimal(s) { return this.wrap(F.withCStr(s, (p) => F.raw('fmpq_from_dec', p))); }
  num(x) { return ZZ.wrap(F.raw('fmpq_num', x.ptr)); }
  den(x) { return ZZ.wrap(F.raw('fmpq_den', x.ptr)); }
  toStr(x) { return F.str(F.raw('fmpq_get_str', x.ptr, 10)); }
  toNumber(x) { return F.raw('fmpq_get_d', x.ptr); }
  cmp(a, b) { return this.op('fmpq_cmp', a, b); }
  sgn(a) { return this.op('fmpq_sgn', a); }
  isZero(a) { return this.op('fmpq_is_zero', a) !== 0; }
  isField() { return true; }
}

class RealField extends Ring {
  constructor() { super('arb'); this.name = 'RR'; this.level = 2; }
  accepts(S) { return S === this || S === ZZ || S === QQ; }
  coerce(x) {
    if (x.ring === this) return x;
    if (x.ring === ZZ) return this.op('arb_set_fmpz', x);
    if (x.ring === QQ) return this.op('arb_set_fmpq', x);
    return super.coerce(x);
  }
  fromString(s) { return this.wrap(F.withCStr(s, (p) => F.raw('arb_from_str', p, F.prec))); }
  fromNumber(d) { return this.wrap(F.raw('arb_from_d', d)); }
  toStr(x, digits, flags = 0) { return F.str(F.raw('arb_get_str', x.ptr, digits, flags)); }
  mid(x) { return F.raw('arb_mid_d', x.ptr); }
  rad(x) { return F.raw('arb_rad_d', x.ptr); }
  div(a, b) { return this.op('arb_div', a, b); }
  // Comparação trivalente: true/false ou erro se indecidível.
  cmpOp(a, b, op) {
    const r = F.raw('arb_cmp3', a.ptr, b.ptr, op);
    if (r < 0) fail('comparação indecidível com a precisão atual (as bolas se sobrepõem); aumente prec');
    return r === 1;
  }
  eq(a, b) { return this.cmpOp(a, b, 0); }
  isField() { return true; }
}

class ComplexField extends Ring {
  constructor() { super('acb'); this.name = 'CC'; this.level = 3; }
  accepts(S) { return S === this || S === ZZ || S === QQ || S === RR; }
  coerce(x) {
    if (x.ring === this) return x;
    if (x.ring === ZZ) return this.op('acb_set_fmpz', x);
    if (x.ring === QQ) return this.op('acb_set_fmpq', x);
    if (x.ring === RR) return this.op('acb_set_arb', x);
    return super.coerce(x);
  }
  fromParts(re, im) { return this.wrap(F.raw('acb_from_arb2', re.ptr, im.ptr)); }
  re(x) { return this.op('acb_real', x); }
  im(x) { return this.op('acb_imag', x); }
  eq(a, b) {
    const r = F.raw('acb_eq3', a.ptr, b.ptr);
    if (r < 0) fail('comparação indecidível com a precisão atual (as bolas se sobrepõem); aumente prec');
    return r === 1;
  }
  isField() { return true; }
}

export class ZmodRing extends Ring {
  constructor(n) {
    super('zmod', F.raw('modctx_new', n.ptr));
    this.n = n;
    this.nstr = ZZ.toStr(n);
    this.name = `Zmod(${this.nstr})`;
    this.prime = ZZ.op('fmpz_is_probabprime', n) !== 0;
  }
  accepts(S) { return S === this || S === ZZ; }
  coerce(x) {
    if (x.ring === this) return x;
    if (x.ring === ZZ) return this.op('zmod_set_fmpz', x);
    if (x.ring === QQ) {
      const num = this.coerce(QQ.num(x));
      const den = this.coerce(QQ.den(x));
      return this.div(num, den);
    }
    return super.coerce(x);
  }
  div(a, b) { return this.op('zmod_divides', a, b); }
  lift(x) { return ZZ.op('fmpz_set', x); }
  isField() { return this.prime; }
}

export class FiniteField extends Ring {
  constructor(p, k, v) {
    const ctx = F.withCStr(v, (vp) => F.raw('fqctx_new', p.ptr, k, vp));
    super('fq', ctx);
    this.p = p;
    this.k = k;
    this.v = v;
    const ps = ZZ.toStr(p);
    this.name = k === 1 ? `GF(${ps})` : `GF(${ps}^${k})`;
  }
  accepts(S) { return S === this || S === ZZ; }
  coerce(x) {
    if (x.ring === this) return x;
    if (x.ring === ZZ) return this.op('fq_set_fmpz', x);
    if (x.ring instanceof ZmodRing && ZZ.cmp(x.ring.n, this.p) === 0) return this.op('fq_set_fmpz', x);
    return super.coerce(x);
  }
  div(a, b) {
    if (this.op('fq_is_zero', b)) fail('divisão por zero');
    return this.op('fq_div', a, b);
  }
  gen() { return this.op('fq_gen'); }
  toStr(x) { return F.str(F.raw('fq_get_str', x.ptr, this.ctx)); }
  isField() { return true; }
}

const POLY_TAG = { fmpz: 'fmpz_poly', fmpq: 'fmpq_poly', arb: 'arb_poly', acb: 'acb_poly', zmod: 'zmod_poly', fq: 'fq_poly' };
const MAT_TAG = { fmpz: 'fmpz_mat', fmpq: 'fmpq_mat', arb: 'arb_mat', acb: 'acb_mat', zmod: 'zmod_mat', fq: 'fq_mat' };

export class PolyRing extends Ring {
  constructor(base, v) {
    const tag = POLY_TAG[base.tag];
    if (!tag) fail(`polinômios sobre ${base} não são suportados`);
    super(tag, base.ctx);
    this.base = base;
    this.v = v;
    this.name = `${base}[${v}]`;
  }

  accepts(S) {
    if (S === this) return true;
    if (S instanceof PolyRing) return S.v === this.v && this.base.accepts(S.base);
    return this.base.accepts(S);
  }

  coerce(x) {
    const S = x.ring;
    if (S === this) return x;
    if (S instanceof PolyRing) {
      if (S.v !== this.v) fail(`variáveis diferentes: ${S} e ${this}`);
      const special = POLY_CONV[`${S.tag}>${this.tag}`];
      if (special) return special(this, x);
      return this.fromCoeffs(S.coeffs(x).map((c) => this.base.coerce(c)));
    }
    if (this.base.accepts(S)) return this.fromCoeffs([this.base.coerce(x)]);
    return super.coerce(x);
  }

  len(p) { return F.raw(`len_${this.tag}`, p.ptr, this.ctx); }
  degree(p) { return this.len(p) - 1; }
  coeff(p, i) { return this.base.wrap(F.raw(`coeff_${this.tag}`, p.ptr, i, this.ctx)); }
  coeffs(p) {
    const n = this.len(p);
    const out = [];
    for (let i = 0; i < n; i++) out.push(this.coeff(p, i));
    return out;
  }

  fromCoeffs(cs) {
    const p = this.wrap(F.raw(`new_${this.tag}`, this.ctx));
    cs.forEach((c, i) => F.raw(`setcoeff_${this.tag}`, p.ptr, i, this.base.coerce(c).ptr, this.ctx));
    return p;
  }

  gen() {
    return this.fromCoeffs([this.base.zero(), this.base.one()]);
  }

  scalarMul(p, c) {
    c = this.base.coerce(c);
    return this.op(`${this.tag}_scalar_mul`, p, c);
  }

  pow(p, e) { return this.op(`${this.tag}_pow`, p, e); }
  isField() { return false; }
}

const MPOLY_TAG = { fmpz: 'fmpz_mpoly', fmpq: 'fmpq_mpoly', zmod: 'zmod_mpoly' };
export const ORDERS = ['lex', 'deglex', 'degrevlex'];

// Polinômios em várias variáveis (ZZ, QQ ou Z/nZ). Os nomes das variáveis e a
// ordem monomial ficam aqui; a FLINT só conhece os índices.
export class MPolyRing extends Ring {
  constructor(base, vars, order) {
    const tag = MPOLY_TAG[base.tag];
    if (!tag) fail(`polinômios em várias variáveis sobre ${base} não são suportados (use ZZ, QQ ou Zmod(n))`);
    const ord = ORDERS.indexOf(order);
    const ctx = tag === 'zmod_mpoly'
      ? F.raw('mctx_new_zmod_mpoly', vars.length, ord, base.n.ptr)
      : F.raw(`mctx_new_${tag}`, vars.length, ord);
    super(tag, ctx);
    this.base = base;
    this.vars = vars;
    this.order = order;
    this.name = `${base}[${vars.join(', ')}${order === 'degrevlex' ? '' : `, order = "${order}"`}]`;
  }

  get nvars() { return this.vars.length; }
  index(v) { return this.vars.indexOf(v); }

  // Elementos de S que vêm para cá: escalares, R[x] e R[x, ...] com variáveis
  // contidas nas deste anel.
  accepts(S) {
    if (S === this) return true;
    if (S instanceof MPolyRing) return S.vars.every((v) => this.vars.includes(v)) && this.acceptsBase(S.base);
    if (S instanceof PolyRing) return this.vars.includes(S.v) && this.acceptsBase(S.base);
    if (S instanceof MatSpace) return false;
    return this.acceptsBase(S);
  }

  acceptsBase(S) {
    return this.base.accepts(S) || (this.base instanceof ZmodRing && S === QQ);
  }

  coerce(x) {
    const S = x.ring;
    if (S === this) return x;
    if (S instanceof MPolyRing) {
      const map = S.vars.map((v) => this.index(v));
      if (map.includes(-1)) fail(`não é possível converter ${S} em ${this}`);
      return this.fromTerms(S.terms(x).map(({ c, e }) => {
        const f = new Array(this.nvars).fill(0);
        e.forEach((k, i) => { f[map[i]] = k; });
        return { c, e: f };
      }));
    }
    if (S instanceof PolyRing) {
      const j = this.index(S.v);
      if (j < 0) fail(`não é possível converter ${S} em ${this}`);
      return this.fromTerms(S.coeffs(x).map((c, i) => {
        const e = new Array(this.nvars).fill(0);
        e[j] = i;
        return { c, e };
      }));
    }
    if (this.acceptsBase(S)) return this.constant(x);
    return super.coerce(x);
  }

  constant(c) {
    return this.wrap(F.raw(`const_${this.tag}`, coerce(c, this.base).ptr, this.ctx));
  }

  len(p) { return F.raw(`len_${this.tag}`, p.ptr, this.ctx); }

  // Termos na ordem monomial do anel (do maior para o menor): [{c, e}].
  terms(p) {
    const n = this.len(p);
    const k = this.nvars;
    const buf = F.M._malloc(8 * Math.max(1, k));
    try {
      const out = [];
      for (let i = 0; i < n; i++) {
        if (!F.raw(`term_exp_${this.tag}`, p.ptr, i, buf, this.ctx)) fail('expoente grande demais');
        const e = Array.from(F.M.HEAPU32.subarray(buf >> 2, (buf >> 2) + k));
        out.push({ c: this.base.wrap(F.raw(`term_coeff_${this.tag}`, p.ptr, i, this.ctx)), e });
      }
      return out;
    } finally {
      F.M._free(buf);
    }
  }

  fromTerms(terms) {
    const p = this.wrap(F.raw(`new_${this.tag}`, this.ctx));
    const k = this.nvars;
    const buf = F.M._malloc(4 * Math.max(1, k));
    try {
      for (const { c, e } of terms) {
        for (let i = 0; i < k; i++) F.M.HEAPU32[(buf >> 2) + i] = e[i];
        F.raw(`push_${this.tag}`, p.ptr, coerce(c, this.base).ptr, buf, this.ctx);
      }
      F.raw(`finish_${this.tag}`, p.ptr, this.ctx);
    } finally {
      F.M._free(buf);
    }
    return p;
  }

  gen(i = 0) { return this.wrap(F.raw(`gen_${this.tag}`, i, this.ctx)); }
  gens() { return this.vars.map((_, i) => this.gen(i)); }

  // Constante (todos os expoentes nulos)? Devolve o coeficiente ou null.
  constantValue(p) {
    const n = this.len(p);
    if (n === 0) return this.base.zero();
    if (n > 1 || this.totalDegree(p) !== 0) return null;
    return this.terms(p)[0].c;
  }

  totalDegree(p) { return this.op(`${this.tag}_total_degree`, p); }
  degreeIn(p, i) { return this.op(`${this.tag}_degree`, p, i); }
  degree(p) { return this.len(p) ? this.totalDegree(p) : -1; }

  // Variáveis que aparecem em p (índices).
  usedVars(p) {
    const used = new Set();
    for (let i = 0; i < this.nvars; i++) if (this.len(p) && this.degreeIn(p, i) > 0) used.add(i);
    return [...used];
  }

  scalarMul(p, c) { return this.op(`${this.tag}_scalar_mul`, p, coerce(c, this.base)); }
  pow(p, e) { return this.op(`${this.tag}_pow`, p, e); }
  isZero(p) { return this.len(p) === 0; }
  isField() { return false; }
  requirePrime(what) {
    if (this.base instanceof ZmodRing && !this.base.prime) fail(`${what} em ${this} requer n primo`);
  }
}

export class MatSpace extends Ring {
  constructor(base) {
    const tag = MAT_TAG[base.tag];
    if (!tag) fail(`matrizes sobre ${base} não são suportadas`);
    super(tag, base.ctx);
    this.base = base;
    this.name = `Mat(${base})`;
  }

  accepts(S) {
    return S === this || (S instanceof MatSpace && this.base.accepts(S.base));
  }

  coerce(x) {
    const S = x.ring;
    if (S === this) return x;
    if (S instanceof MatSpace && this.base.accepts(S.base)) {
      const special = MAT_CONV[`${S.tag}>${this.tag}`];
      if (special) return special(this, x);
      return this.fromRows(S.rows(x).map((r) => r.map((e) => this.base.coerce(e))));
    }
    return super.coerce(x);
  }

  nrows(m) { return F.raw(`nrows_${this.tag}`, m.ptr, this.ctx); }
  ncols(m) { return F.raw(`ncols_${this.tag}`, m.ptr, this.ctx); }
  entry(m, i, j) { return this.base.wrap(F.raw(`entry_${this.tag}`, m.ptr, i, j, this.ctx)); }
  rows(m) {
    const r = this.nrows(m), c = this.ncols(m);
    const out = [];
    for (let i = 0; i < r; i++) {
      const row = [];
      for (let j = 0; j < c; j++) row.push(this.entry(m, i, j));
      out.push(row);
    }
    return out;
  }

  alloc(r, c) { return this.wrap(F.raw(`new_${this.tag}`, r, c, this.ctx)); }

  fromRows(rows) {
    const r = rows.length;
    const c = r ? rows[0].length : 0;
    for (const row of rows) if (row.length !== c) fail('linhas da matriz com tamanhos diferentes');
    const m = this.alloc(r, c);
    rows.forEach((row, i) => row.forEach((e, j) => {
      F.raw(`setentry_${this.tag}`, m.ptr, i, j, this.base.coerce(e).ptr, this.ctx);
    }));
    return m;
  }

  identity(n) {
    const one = this.base.one();
    const m = this.alloc(n, n);
    for (let i = 0; i < n; i++) F.raw(`setentry_${this.tag}`, m.ptr, i, i, one.ptr, this.ctx);
    return m;
  }

  scalarMul(m, c) {
    c = this.base.coerce(c);
    if (this.has('scalar_mul')) return this.op(`${this.tag}_scalar_mul`, m, c);
    return this.fromRows(this.rows(m).map((r) => r.map((e) => this.base.mul(e, c))));
  }

  mul(a, b) {
    if (this.ncols(a) !== this.nrows(b)) {
      fail(`dimensões incompatíveis: ${this.nrows(a)}×${this.ncols(a)} · ${this.nrows(b)}×${this.ncols(b)}`);
    }
    return this.op(`${this.tag}_mul`, a, b);
  }

  checkSame(a, b) {
    if (this.nrows(a) !== this.nrows(b) || this.ncols(a) !== this.ncols(b)) {
      fail(`dimensões incompatíveis: ${this.nrows(a)}×${this.ncols(a)} e ${this.nrows(b)}×${this.ncols(b)}`);
    }
  }

  add(a, b) { this.checkSame(a, b); return super.add(a, b); }
  sub(a, b) { this.checkSame(a, b); return super.sub(a, b); }
  eq(a, b) {
    if (this.nrows(a) !== this.nrows(b) || this.ncols(a) !== this.ncols(b)) return false;
    return super.eq(a, b);
  }
  neg(a) {
    if (this.has('neg')) return super.neg(a);
    return this.scalarMul(a, this.base.fromInt(-1));
  }
  isSquare(a) { return this.nrows(a) === this.ncols(a); }
}

const POLY_CONV = {
  'fmpz_poly>fmpq_poly': (R, x) => R.op('fmpq_poly_set_fmpz_poly', x),
  'fmpq_poly>arb_poly': (R, x) => R.op('arb_poly_set_fmpq_poly', x),
  'fmpz_poly>arb_poly': (R, x) => R.op('arb_poly_set_fmpq_poly', QQx(x.ring.v).coerce(x)),
  'fmpq_poly>acb_poly': (R, x) => R.op('acb_poly_set_fmpq_poly', x),
  'fmpz_poly>acb_poly': (R, x) => R.op('acb_poly_set_fmpq_poly', QQx(x.ring.v).coerce(x)),
  'arb_poly>acb_poly': (R, x) => R.op('acb_poly_set_arb_poly', x),
  'fmpz_poly>zmod_poly': (R, x) => R.op('zmod_poly_set_fmpz_poly', x),
};

const MAT_CONV = {
  'fmpz_mat>fmpq_mat': (R, x) => R.op('fmpq_mat_set_fmpz_mat', x),
  'fmpq_mat>arb_mat': (R, x) => R.op('arb_mat_set_fmpq_mat', x),
  'fmpz_mat>arb_mat': (R, x) => R.op('arb_mat_set_fmpq_mat', Mat(QQ).coerce(x)),
  'arb_mat>acb_mat': (R, x) => R.op('acb_mat_set_arb_mat', x),
  'fmpz_mat>zmod_mat': (R, x) => R.op('zmod_mat_set_fmpz_mat', x),
};

export const ZZ = new IntegerRing();
export const QQ = new RationalField();
export const RR = new RealField();
export const CC = new ComplexField();
for (const R of [ZZ, QQ, RR, CC]) {
  R.key = R.name;
  cache.set(R.name, R);
}

const STD_BY_TAG = { fmpz: () => ZZ, fmpq: () => QQ, arb: () => RR, acb: () => CC };

// Anéis criados fora de arenas: seus parâmetros (n, p) são permanentes.
function permanent(fn) {
  const saved = F.arena;
  F.arena = null;
  try {
    return fn();
  } finally {
    F.arena = saved;
  }
}

export function Zmod(n) {
  const key = `Zmod(${ZZ.toStr(n)})`;
  return intern(key, () => {
    if (ZZ.cmp(n, ZZ.fromInt(1)) <= 0) fail('Zmod(n) requer n > 1');
    return permanent(() => new ZmodRing(ZZ.copy(n)));
  });
}

export function GF(p, k = 1, v = 'a') {
  const key = `GF(${ZZ.toStr(p)},${k},${v})`;
  return intern(key, () => permanent(() => new FiniteField(ZZ.copy(p), k, v)));
}

export function Poly(base, v) {
  return intern(`${base.key}[${v}]`, () => new PolyRing(base, v));
}

// R[x, y, ...]; com uma só variável é o anel univariado R[x].
export function MPoly(base, vars, order = 'degrevlex') {
  if (new Set(vars).size !== vars.length) fail('variáveis repetidas');
  if (!ORDERS.includes(order)) fail(`ordem monomial desconhecida: ${order} (use lex, deglex ou degrevlex)`);
  if (vars.length === 1) return Poly(base, vars[0]);
  return intern(`${base.key}[${vars.join(',')};${order}]`, () => new MPolyRing(base, vars, order));
}

export function Mat(base) {
  return intern(`Mat(${base.key})`, () => new MatSpace(base));
}

const QQx = (v) => Poly(QQ, v);

// ------------------------------------------------------------ coerção

export function isScalarRing(R) {
  return !(R instanceof PolyRing) && !(R instanceof MPolyRing) && !(R instanceof MatSpace);
}

const isPolyRing = (R) => R instanceof PolyRing || R instanceof MPolyRing;
const varsOf = (R) => (R instanceof MPolyRing ? R.vars : R instanceof PolyRing ? [R.v] : []);

export function commonRing(A, B) {
  if (A === B) return A;
  if (B.accepts(A)) return B;
  if (A.accepts(B)) return A;
  if (A instanceof MatSpace || B instanceof MatSpace) {
    if (A instanceof MatSpace && B instanceof MatSpace) return Mat(commonRing(A.base, B.base));
    fail(`não há anel comum para ${A} e ${B}`);
  }
  // Variáveis diferentes (ou algum lado já multivariado): junta as variáveis.
  if (A instanceof MPolyRing || B instanceof MPolyRing ||
      (A instanceof PolyRing && B instanceof PolyRing && A.v !== B.v)) {
    const vars = [...varsOf(A)];
    for (const v of varsOf(B)) if (!vars.includes(v)) vars.push(v);
    const base = commonRing(isPolyRing(A) ? A.base : A, isPolyRing(B) ? B.base : B);
    const order = A instanceof MPolyRing ? A.order : B instanceof MPolyRing ? B.order : 'degrevlex';
    return MPoly(base, vars, order);
  }
  if (A instanceof PolyRing || B instanceof PolyRing) {
    const va = A instanceof PolyRing ? A.v : null;
    const vb = B instanceof PolyRing ? B.v : null;
    if (va && vb && va !== vb) fail(`polinômios em variáveis diferentes: ${A} e ${B}`);
    const base = commonRing(A instanceof PolyRing ? A.base : A, B instanceof PolyRing ? B.base : B);
    return Poly(base, va ?? vb);
  }
  if (A instanceof ZmodRing && B === QQ) return A;
  if (B instanceof ZmodRing && A === QQ) return B;
  if (A instanceof FiniteField && B instanceof ZmodRing && ZZ.cmp(B.n, A.p) === 0) return A;
  if (B instanceof FiniteField && A instanceof ZmodRing && ZZ.cmp(A.n, B.p) === 0) return B;
  fail(`não há anel comum para ${A} e ${B}`);
}

export function coerce(x, R) {
  if (x.ring === R) return x;
  if (R instanceof MPolyRing && R.accepts(x.ring)) return R.coerce(x);
  if (R instanceof ZmodRing && x.ring === QQ) return R.coerce(x);
  if (R instanceof FiniteField && x.ring instanceof ZmodRing) return R.coerce(x);
  if (!R.accepts(x.ring)) fail(`não é possível converter ${x.ring} em ${R}`);
  return R.coerce(x);
}

function unify(a, b) {
  const R = commonRing(a.ring, b.ring);
  return [R, coerce(a, R), coerce(b, R)];
}

// --------------------------------------------------------- aritmética

export function add(a, b) {
  const [R, x, y] = unify(a, b);
  return R.add(x, y);
}

export function sub(a, b) {
  const [R, x, y] = unify(a, b);
  return R.sub(x, y);
}

export function neg(a) {
  return a.ring.neg(a);
}

export function mul(a, b) {
  const A = a.ring, B = b.ring;
  // Escalar × matriz e escalar × polinômio sem promover o escalar.
  if (A instanceof MatSpace && !(B instanceof MatSpace)) return scalarMat(a, b);
  if (B instanceof MatSpace && !(A instanceof MatSpace)) return scalarMat(b, a);
  const [R, x, y] = unify(a, b);
  return R.mul(x, y);
}

function scalarMat(m, c) {
  const base = commonRing(m.ring.base, c.ring);
  const S = Mat(base);
  return S.scalarMul(coerce(m, S), coerce(c, base));
}

export function isZero(x) {
  const R = x.ring;
  if (R === ZZ) return ZZ.isZero(x);
  if (R === QQ) return QQ.isZero(x);
  if (R === RR) return F.raw('arb_cmp3', x.ptr, RR.zero().ptr, 0) === 1;
  if (R === CC) return F.raw('acb_eq3', x.ptr, CC.zero().ptr) === 1;
  if (R instanceof PolyRing || R instanceof MPolyRing) return R.len(x) === 0;
  return R.eq(x, R.zero());
}

export function div(a, b) {
  const A = a.ring, B = b.ring;
  if (A instanceof MatSpace && isScalarRing(B)) return mul(a, inv(b));
  if (B instanceof MatSpace) return mul(a, inv(b));
  let [R, x, y] = unify(a, b);
  if (R === ZZ) {
    if (ZZ.isZero(y)) fail('divisão por zero');
    return QQ.op('fmpq_div', QQ.coerce(x), QQ.coerce(y));
  }
  if (R === QQ) {
    if (QQ.isZero(y)) fail('divisão por zero');
    return QQ.op('fmpq_div', x, y);
  }
  if (R === RR || R === CC || R instanceof ZmodRing || R instanceof FiniteField) {
    if (R instanceof ZmodRing && ZZ.isZero(y)) fail('divisão por zero');
    return R.div ? R.div(x, y) : R.op(`${R.tag}_div`, x, y);
  }
  if (R instanceof PolyRing) return polyDiv(R, x, y);
  if (R instanceof MPolyRing) return mpolyDiv(R, x, y);
  fail(`divisão não suportada em ${R}`);
}

function mpolyDiv(R, x, y) {
  if (R.isZero(y)) fail('divisão por zero');
  const c = R.constantValue(y);
  if (c !== null) {
    if (R.base === ZZ) return mpolyDiv(MPolyQQ(R), coerce(x, MPolyQQ(R)), coerce(y, MPolyQQ(R)));
    return R.scalarMul(x, inv(c));
  }
  R.requirePrime('divisão');
  try {
    return R.op(`${R.tag}_divides`, x, y);
  } catch (e) {
    if (R.base === ZZ) return mpolyDiv(MPolyQQ(R), coerce(x, MPolyQQ(R)), coerce(y, MPolyQQ(R)));
    if (/divisão não exata/.test(e.message)) fail('divisão não exata de polinômios; use divrem, quo ou rem');
    throw e;
  }
}

const MPolyQQ = (R) => MPoly(QQ, R.vars, R.order);

// Divisão de a pelos polinômios bs (algoritmo de divisão multivariado na
// ordem do anel): [[q1, ...], r] com a = Σ qi·bi + r.
export function mdivrem(a, bs) {
  let R = a.ring;
  for (const b of bs) R = commonRing(R, b.ring);
  if (!(R instanceof MPolyRing)) fail('divrem com lista de divisores requer polinômios em várias variáveis');
  if (R.base === ZZ) R = MPolyQQ(R);
  R.requirePrime('divrem');
  const n = bs.length;
  const arr = F.M._malloc(4 * Math.max(1, n));
  try {
    const ys = bs.map((b) => coerce(b, R));
    ys.forEach((y, i) => { F.M.HEAPU32[(arr >> 2) + i] = y.ptr; });
    const v = F.vec(F.raw(`divrem_ideal_${R.tag}`, coerce(a, R).ptr, arr, n, R.ctx)).map((p) => R.wrap(p));
    return [v.slice(1), v[0]];
  } finally {
    F.M._free(arr);
  }
}

function polyDiv(R, x, y) {
  if (R.len(y) === 0) fail('divisão por zero');
  if (R.len(y) === 1) {
    // Divisão por constante.
    const c = R.coeff(y, 0);
    if (R.base === ZZ) return polyDiv(Poly(QQ, R.v), coerce(x, Poly(QQ, R.v)), coerce(y, Poly(QQ, R.v)));
    return R.scalarMul(x, inv(c));
  }
  if (R.base === ZZ) {
    try {
      return R.op('fmpz_poly_divides', x, y);
    } catch {
      return polyDiv(Poly(QQ, R.v), coerce(x, Poly(QQ, R.v)), coerce(y, Poly(QQ, R.v)));
    }
  }
  if (R.base === RR || R.base === CC) fail('divisão de polinômios reais/complexos: use divrem(p, q)');
  const [q, r] = divrem(x, y);
  if (R.len(r) !== 0) fail('divisão não exata de polinômios; use divrem, quo ou rem');
  return q;
}

export function divrem(a, b) {
  let [R, x, y] = unify(a, b);
  if (R instanceof MPolyRing) {
    const [[q], r] = mdivrem(x, [y]);
    return [q, r];
  }
  if (R === ZZ) {
    return F.vec(F.raw('divrem_fmpz', x.ptr, y.ptr, 0)).map((p) => ZZ.wrap(p));
  }
  if (R instanceof PolyRing) {
    if (R.base === ZZ) {
      R = Poly(QQ, R.v);
      x = coerce(x, R);
      y = coerce(y, R);
    }
    if (R.base instanceof ZmodRing && !R.base.prime) fail('divrem em Z/nZ[x] requer n primo');
    F.raw('set_prec', F.prec);
    return F.vec(F.raw(`divrem_${R.tag}`, x.ptr, y.ptr, R.ctx)).map((p) => R.wrap(p));
  }
  fail(`divrem não suportado em ${R}`);
}

export function inv(a) {
  const R = a.ring;
  if (R === ZZ || R === QQ) {
    if (isZero(a)) fail('divisão por zero');
    return QQ.op('fmpq_inv', QQ.coerce(a));
  }
  if (R === RR) return RR.op('arb_div', RR.one(), a);
  if (R === CC) return CC.op('acb_div', CC.one(), a);
  if (R instanceof ZmodRing) return R.op('zmod_inv', a);
  if (R instanceof FiniteField) return R.div(R.one(), a);
  if (R instanceof MatSpace) return matInv(a);
  if (R instanceof PolyRing && R.len(a) === 1) return R.fromCoeffs([inv(R.coeff(a, 0))]);
  if (R instanceof MPolyRing) {
    const c = R.constantValue(a);
    if (c !== null) return coerce(inv(c), R.base === ZZ ? MPolyQQ(R) : R);
  }
  fail(`inverso não suportado em ${R}`);
}

export function matInv(m) {
  let R = m.ring;
  if (!R.isSquare(m)) fail('a matriz deve ser quadrada');
  if (R.base === ZZ) {
    R = Mat(QQ);
    m = coerce(m, R);
  }
  switch (R.tag) {
    case 'fmpq_mat': return R.wrap(F.raw('fmpq_mat_inv', m.ptr));
    case 'arb_mat': return R.wrap(F.raw('arb_mat_inv', m.ptr, F.prec));
    case 'acb_mat': return R.wrap(F.raw('acb_mat_inv', m.ptr, F.prec));
    case 'zmod_mat': return R.wrap(F.raw('zmod_mat_inv', m.ptr, R.ctx));
    case 'fq_mat': return R.wrap(F.raw('fq_mat_inv', m.ptr, R.ctx));
  }
  fail(`inversa não suportada em ${R}`);
}

// Expoente: Elem de ZZ (ou QQ/RR/CC para potências reais).
export function pow(a, e) {
  const A = a.ring;
  if (e.ring === ZZ) {
    const n = ZZ.toSmall(e);
    const neg = ZZ.sgn(e) < 0;
    if (A === ZZ) {
      if (neg) return pow(QQ.coerce(a), e);
      if (n === null) {
        if (ZZ.op('fmpz_is_zero', a) || ZZ.op('fmpz_is_one', a)) return a;
        if (ZZ.cmp(a, ZZ.fromInt(-1)) === 0) return ZZ.op('fmpz_is_even', e) ? ZZ.one() : a;
        fail('expoente grande demais');
      }
      return ZZ.op('fmpz_pow_ui', a, n);
    }
    if (A === QQ) {
      if (n === null) fail('expoente grande demais');
      if (neg && QQ.isZero(a)) fail('divisão por zero');
      return QQ.op('fmpq_pow_si', a, n);
    }
    if (A === RR) return RR.op('arb_pow_fmpz', a, e);
    if (A === CC) return CC.op('acb_pow_fmpz', a, e);
    if (A instanceof ZmodRing) return A.op('zmod_pow', a, e);
    if (A instanceof FiniteField) {
      if (neg) return A.op('fq_pow', inv(a), neg1(e));
      return A.op('fq_pow', a, e);
    }
    if (A instanceof PolyRing) {
      if (neg) return pow(inv(a), neg1(e));
      if (n === null) fail('expoente grande demais');
      return A.pow(a, n);
    }
    if (A instanceof MPolyRing) {
      if (neg) return pow(inv(a), neg1(e));
      if (n === null) fail('expoente grande demais');
      return A.pow(a, n);
    }
    if (A instanceof MatSpace) {
      if (!A.isSquare(a)) fail('a matriz deve ser quadrada');
      if (neg) return pow(matInv(a), neg1(e));
      if (n === null) fail('expoente grande demais');
      if (A.has('pow')) return A.op(`${A.tag}_pow`, a, n);
      return powBySquaring(a, n, A.identity(A.nrows(a)), (x, y) => A.mul(x, y));
    }
    fail(`potência não suportada em ${A}`);
  }
  if (e.ring === QQ && (A === ZZ || A === QQ || A === RR)) {
    const r = RR.op('arb_pow_fmpq', RR.coerce(a), e);
    return finiteOr(r, () => CC.op('acb_pow', CC.coerce(a), CC.coerce(e)));
  }
  if (isScalarRing(A) && (e.ring === RR || e.ring === CC || e.ring === QQ)) {
    const R = commonRing(A, e.ring);
    if (R === RR) {
      const r = RR.op('arb_pow', RR.coerce(a), RR.coerce(e));
      return finiteOr(r, () => CC.op('acb_pow', CC.coerce(a), CC.coerce(e)));
    }
    if (R === CC) return CC.op('acb_pow', coerce(a, CC), coerce(e, CC));
  }
  fail(`potência ${A}^${e.ring} não suportada`);
}

function neg1(e) { return ZZ.neg(e); }

function powBySquaring(x, n, one, mulf) {
  let r = one;
  let b = x;
  while (n > 0) {
    if (n & 1) r = mulf(r, b);
    n >>>= 1;
    if (n) b = mulf(b, b);
  }
  return r;
}

// Se uma bola real não é finita (ex.: sqrt(-2)), recalcula em CC.
export function finiteOr(r, fallback) {
  if (r.ring === RR && !RR.op('arb_is_finite', r)) return fallback();
  return r;
}

export function equal(a, b) {
  let R;
  try {
    R = commonRing(a.ring, b.ring);
  } catch {
    return false;
  }
  return R.eq(coerce(a, R), coerce(b, R));
}

// <, <=, >, >= : apenas anéis ordenados (ZZ, QQ, RR).
export function compare(a, b, op) {
  const R = commonRing(a.ring, b.ring);
  const x = coerce(a, R), y = coerce(b, R);
  if (R === ZZ || R === QQ) {
    const c = R.cmp(x, y);
    return op === '<' ? c < 0 : op === '<=' ? c <= 0 : op === '>' ? c > 0 : c >= 0;
  }
  if (R === RR) {
    switch (op) {
      case '<': return RR.cmpOp(x, y, 1);
      case '<=': return RR.cmpOp(x, y, 2);
      case '>': return RR.cmpOp(y, x, 1);
      case '>=': return RR.cmpOp(y, x, 2);
    }
  }
  fail(`${R} não é ordenado`);
}

export function sign(a) {
  if (a.ring === ZZ) return ZZ.sgn(a);
  if (a.ring === QQ) return QQ.sgn(a);
  if (a.ring === RR) {
    const z = RR.zero();
    if (RR.cmpOp(a, z, 1)) return -1;
    if (RR.cmpOp(z, a, 1)) return 1;
    return 0;
  }
  fail(`sinal não definido em ${a.ring}`);
}

export function floorDiv(a, b) {
  const [R, x, y] = unify(a, b);
  if (R === ZZ) {
    if (ZZ.isZero(y)) fail('divisão por zero');
    return ZZ.op('fmpz_fdiv_q', x, y);
  }
  if (R instanceof PolyRing || R instanceof MPolyRing) return divrem(x, y)[0];
  if (R === QQ || R === RR) return floor(div(x, y));
  fail(`// não suportado em ${R}`);
}

export function mod(a, b) {
  const [R, x, y] = unify(a, b);
  if (R === ZZ) {
    if (ZZ.isZero(y)) fail('divisão por zero');
    return ZZ.op('fmpz_fdiv_r', x, y);
  }
  if (R instanceof PolyRing || R instanceof MPolyRing) return divrem(x, y)[1];
  if (R === QQ || R === RR) return sub(x, mul(y, floor(div(x, y))));
  fail(`% não suportado em ${R}`);
}

export function floor(a) {
  if (a.ring === ZZ) return a;
  if (a.ring === QQ) return QQ.opTo(ZZ, 'fmpq_floor', a);
  if (a.ring === RR) return ZZ.wrap(F.raw('arb_get_unique_fmpz', RR.op('arb_floor', a).ptr));
  fail(`floor não definido em ${a.ring}`);
}

export function ceil(a) {
  if (a.ring === ZZ) return a;
  if (a.ring === QQ) return ZZ.neg(floor(QQ.neg(a)));
  if (a.ring === RR) return ZZ.wrap(F.raw('arb_get_unique_fmpz', RR.op('arb_ceil', a).ptr));
  fail(`ceil não definido em ${a.ring}`);
}
