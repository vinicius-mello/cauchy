// Converte valores da linguagem em estruturas de exibição serializáveis
// (enviadas do worker para a UI) e em texto simples.
//
// Estruturas: {t:'int'|'rat'|'ball'|'cplx'|'gf'|'poly'|'mat'|'list'|'tuple'|
//   'mpoly'|'factored'|'str'|'bool'|'fn'|'ring'|'unit'|'graphics'|'widget'|'more', ...}

import { Elem, Ring, ZZ, QQ, RR, CC, ZmodRing, FiniteField, PolyRing, MPolyRing, MatSpace, Poly, flint, equal } from './rings.js';
import { Tuple, Func, Factored, Graphic, Widget, asGraphic } from './values.js';

const MAX_ITEMS = 500;
const MAX_DIGITS = 5000;

export function display(v, opts = {}) {
  if (v instanceof Elem) return showElem(v, opts);
  if (v instanceof Factored) {
    return {
      t: 'factored',
      unit: v.unit && !isOne(v.unit) ? display(v.unit) : null,
      factors: v.map((t) => ({ b: display(t.items[0]), e: ZZ.toStr(t.items[1]) })),
    };
  }
  if (Array.isArray(v)) {
    const g = asGraphic(v);
    if (g) return g.display();
    const items = v.slice(0, MAX_ITEMS).map((x) => display(x, opts));
    return { t: 'list', items, more: Math.max(0, v.length - MAX_ITEMS) };
  }
  if (v instanceof Tuple) {
    if (v.items.length === 0) return { t: 'unit' };
    return { t: 'tuple', items: v.items.map((x) => display(x, opts)) };
  }
  if (typeof v === 'string') return { t: 'str', s: v };
  if (typeof v === 'boolean') return { t: 'bool', v };
  if (typeof v === 'number') return { t: 'int', s: String(v) };
  if (v instanceof Func) return { t: 'fn', name: v.name ?? null, arity: v.arity ?? null };
  if (v instanceof Ring) return { t: 'ring', s: v.name };
  if (v instanceof Graphic) return v.display();
  if (v instanceof Widget) return v.display();
  if (v === null || v === undefined) return { t: 'unit' };
  return { t: 'str', s: String(v) };
}

function isOne(x) {
  return x instanceof Elem && equal(x, x.ring.one());
}

function digitsFor(prec) {
  return Math.max(3, Math.floor(prec * 0.30103));
}

function showInt(s) {
  const neg = s.startsWith('-');
  const digits = neg ? s.length - 1 : s.length;
  if (s.length > MAX_DIGITS) {
    return { t: 'int', s: s.slice(0, 40) + '…' + s.slice(-40), full: s, ndigits: digits };
  }
  return { t: 'int', s };
}

export function ballParts(str) {
  // "[3.14 +/- 1.2e-5]" | "3.14" | "[+/- 1.2e-5]" | "nan" | "+inf"
  const m = /^\[(.*?)\s*\+\/-\s*(.*)\]$/.exec(str);
  if (!m) return { mid: trimZeros(str), rad: null };
  return { mid: m[1] || '0', rad: m[2], zero: !m[1] };
}

// Valores exatos: "2.5000" -> "2.5", "2.000e+5" -> "2e+5"
function trimZeros(s) {
  return s.replace(/^(-?\d+)\.(\d*?)0+((?:e[+-]?\d+)?)$/, (_, a, b, e) => (b ? `${a}.${b}${e}` : `${a}${e}`));
}

function showBall(x, opts) {
  const F = flint();
  let digits = opts.digits;
  if (digits === undefined) {
    // Dígitos conforme a acurácia da própria bola (que pode ter sido
    // calculada com precisão maior que a corrente).
    const acc = RR.op('arb_rel_accuracy_bits', x);
    digits = acc > 1e6 ? digitsFor(F.prec) : Math.min(1_000_000, Math.max(3, Math.floor(acc * 0.30103) + 3));
  }
  const s = RR.toStr(x, digits);
  return { t: 'ball', ...ballParts(s) };
}

function showElem(x, opts) {
  const R = x.ring;
  if (R === ZZ) return showInt(ZZ.toStr(x));
  if (R === QQ) {
    const num = ZZ.toStr(QQ.num(x)), den = ZZ.toStr(QQ.den(x));
    if (den === '1') return showInt(num);
    return { t: 'rat', num, den };
  }
  if (R === RR) return showBall(x, opts);
  if (R === CC) {
    const re = showBall(CC.re(x), opts);
    const imE = CC.im(x);
    const im = showBall(imE, opts);
    return { t: 'cplx', re, im, imZero: im.mid === '0' && !im.rad };
  }
  if (R instanceof ZmodRing) return { t: 'int', s: ZZ.toStr(x), mod: R.nstr };
  if (R instanceof FiniteField) {
    // Representação polinomial no gerador (independente da implementação interna).
    const p = R.opTo(Poly(ZZ, R.v), 'fq_to_poly', x);
    return { t: 'gf', poly: showElem(p, opts), s: toText(showElem(p, opts)) };
  }
  if (R instanceof PolyRing) {
    const n = R.len(x);
    const terms = [];
    for (let i = n - 1; i >= 0 && terms.length < MAX_ITEMS; i--) {
      const c = R.coeff(x, i);
      if (isExactZero(c)) continue;
      terms.push({ c: showElem(c, opts), e: i });
    }
    return { t: 'poly', v: R.v, terms, more: n > MAX_ITEMS };
  }
  if (R instanceof MPolyRing) {
    // Monômios como listas [[variável, expoente], ...] na ordem do anel.
    const n = R.len(x);
    const terms = R.terms(x).slice(0, MAX_ITEMS).map(({ c, e }) => ({
      c: showElem(c, opts),
      m: e.flatMap((k, i) => (k ? [[R.vars[i], k]] : [])),
    }));
    return { t: 'mpoly', terms, more: n > MAX_ITEMS };
  }
  if (R instanceof MatSpace) {
    const r = R.nrows(x), c = R.ncols(x);
    const rows = [];
    for (let i = 0; i < Math.min(r, 60); i++) {
      const row = [];
      for (let j = 0; j < Math.min(c, 60); j++) row.push(showElem(R.entry(x, i, j), opts));
      rows.push(row);
    }
    return { t: 'mat', rows, nrows: r, ncols: c };
  }
  return { t: 'str', s: `<${R}>` };
}

function isExactZero(c) {
  const R = c.ring;
  if (R === ZZ) return ZZ.isZero(c);
  if (R === QQ) return QQ.isZero(c);
  if (R === RR) return RR.op('arb_is_zero', c) !== 0;
  if (R === CC) return CC.op('acb_is_zero', c) !== 0;
  if (R instanceof ZmodRing) return ZZ.isZero(c);
  if (R instanceof FiniteField) return R.op('fq_is_zero', c) !== 0;
  return false;
}

// ----------------------------------------------------------------- texto

const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻' };
const sup = (n) => String(n).split('').map((c) => SUP[c] ?? c).join('');

export function ballText(b) {
  if (!b.rad) return b.mid;
  if (b.zero) return `±${b.rad}`;
  return `${b.mid} ± ${b.rad}`;
}

function isCompound(d) {
  if (d.t === 'poly') return d.terms.length > 1 || (d.terms.length === 1 && toText(d.terms[0].c) !== '1' && d.terms[0].e > 0);
  if (d.t === 'mpoly') return d.terms.length > 1 || (d.terms.length === 1 && toText(d.terms[0].c) !== '1' && d.terms[0].m.length > 0);
  if (d.t === 'gf') return isCompound(d.poly);
  return (d.t === 'cplx' && !d.imZero && !(d.re.mid === '0' && !d.re.rad)) || (d.t === 'ball' && !!d.rad) ||
    (d.t === 'rat' && false);
}

function coeffText(d) {
  const s = toText(d);
  return isCompound(d) ? `(${s})` : s;
}

export function toText(d) {
  switch (d.t) {
    case 'int': return d.s;
    case 'rat': return `${d.num}/${d.den}`;
    case 'ball': return ballText(d);
    case 'cplx': {
      if (d.imZero) return ballText(d.re);
      const im = ballText(d.im);
      if (d.re.mid === '0' && !d.re.rad) return !d.im.rad && d.im.mid === '1' ? 'i' : !d.im.rad && d.im.mid === '-1' ? '-i' : `${im}·i`;
      const imS = d.im.rad ? `(${im})` : im.startsWith('-') ? im.slice(1) : im;
      const op = !d.im.rad && im.startsWith('-') ? '-' : '+';
      return `${ballText(d.re)} ${op} ${imS}·i`;
    }
    case 'gf': return d.s;
    case 'poly': case 'mpoly': {
      if (!d.terms.length) return '0';
      let out = '';
      d.terms.forEach(({ c, e, m }, k) => {
        let cs = coeffText(c);
        let neg = false;
        if (cs.startsWith('-') && !isCompound(c)) {
          neg = true;
          cs = cs.slice(1);
        }
        const mon = m ? m.map(([v, j]) => (j === 1 ? v : `${v}^${j}`)).join('*')
          : e === 0 ? '' : e === 1 ? d.v : `${d.v}^${e}`;
        let term;
        if (!mon) term = cs;
        else if (cs === '1') term = mon;
        else term = `${cs}*${mon}`;
        if (k === 0) out += (neg ? '-' : '') + term;
        else out += (neg ? ' - ' : ' + ') + term;
      });
      return d.more ? `${out} + …` : out;
    }
    case 'mat': return '[' + d.rows.map((r) => r.map(toText).join(', ')).join('; ') + ']';
    case 'list': return '[' + d.items.map(toText).join(', ') + (d.more ? `, … (+${d.more})` : '') + ']';
    case 'tuple': return '(' + d.items.map(toText).join(', ') + (d.items.length === 1 ? ',' : '') + ')';
    case 'unit': return '()';
    case 'factored': {
      const fs = d.factors.map(({ b, e }) => (e === '1' ? coeffText(b) : `${coeffText(b)}^${e}`));
      if (d.unit) fs.unshift(coeffText(d.unit));
      return fs.join(' * ') || '1';
    }
    case 'str': return d.s;
    case 'bool': return d.v ? 'true' : 'false';
    case 'fn': return d.name ? `<função ${d.name}>` : '<função>';
    case 'ring': return d.s;
    case 'graphics': return '<gráfico>';
    case 'widget': return toText(d.value);
    default: return `<${d.t}>`;
  }
}

export function showText(v) {
  return toText(display(v));
}

export { sup };
