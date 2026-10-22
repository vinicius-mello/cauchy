// Avaliador por árvore da linguagem Cauchy.

import { CauchyError } from './lexer.js';
import {
  Elem, Ring, ZZ, QQ, RR, PolyRing, MPolyRing, MatSpace, Poly, MPoly, Mat, flint,
  add, sub, mul, div, neg, pow, equal, compare, floorDiv, mod, commonRing, coerce,
} from '../runtime/rings.js';
import { Tuple, Func, UNIT, Widget, Graphic, asGraphic } from '../runtime/values.js';
import { fail } from '../runtime/errors.js';

export class Env {
  constructor(parent = null, vars = new Map()) {
    this.parent = parent;
    this.vars = vars;
  }

  lookup(name) {
    for (let e = this; e; e = e.parent) {
      if (e.vars.has(name)) return e.vars.get(name);
      if (e.dynamic?.has(name)) return e.dynamic.get(name)();
    }
    return undefined;
  }

  set(name, v) {
    this.vars.set(name, v);
  }

  child() {
    return new Env(this);
  }
}

// Estado por avaliação de célula (widgets, contagem de passos).
export class EvalContext {
  constructor({ widgets = [], onWidget = null } = {}) {
    this.widgets = widgets;
    this.widgetIndex = 0;
    this.onWidget = onWidget;
    this.depth = 0;
  }
}

let ctx = new EvalContext();

export function withContext(c, fn) {
  const saved = ctx;
  ctx = c;
  try {
    return fn();
  } finally {
    ctx = saved;
  }
}

export function currentContext() {
  return ctx;
}

// Anota erros sem posição com a posição do nó sendo avaliado.
function located(node, fn) {
  try {
    return fn();
  } catch (e) {
    if (e instanceof CauchyError && e.pos === undefined) {
      e.pos = node.pos;
      e.end = node.end;
    } else if (e.name === 'FlintError' && e.pos === undefined) {
      const err = new CauchyError(e.message, node.pos, node.end);
      throw err;
    }
    throw e;
  }
}

export function int(n) {
  return ZZ.fromInt(n);
}

export function toBool(v, what = 'condição') {
  if (typeof v !== 'boolean') fail(`${what} deve ser booleana (true/false)`);
  return v;
}

// Converte um valor para inteiro JS pequeno (índices, contagens).
export function toInt(v, what = 'valor') {
  if (v instanceof Elem && v.ring === ZZ) {
    const n = ZZ.toSmall(v);
    if (n === null) fail(`${what} grande demais`);
    return n;
  }
  if (v instanceof Elem && v.ring === QQ && ZZ.toStr(QQ.den(v)) === '1') return toInt(QQ.num(v), what);
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  fail(`${what} deve ser um inteiro`);
}

export function evaluate(node, env) {
  switch (node.k) {
    case 'num': return ZZ.fromString(node.v);
    case 'dec': return RR.fromString(node.v);
    case 'str': return node.v;
    case 'bool': return node.v;
    case 'var': {
      const v = env.lookup(node.name);
      if (v === undefined) throw new CauchyError(`nome não definido: ${node.name}`, node.pos, node.end);
      return v;
    }
    case 'list': return evalItems(node.items, env);
    case 'tuple': return node.items.length === 0 ? UNIT : new Tuple(evalItems(node.items, env));
    case 'range': return located(node, () => evalRange(node, env));
    case 'comp': return located(node, () => evalComp(node, env));
    case 'matrix': return located(node, () => evalMatrix(node, env));
    case 'call': return evalCall(node, env);
    case 'index': return located(node, () => evalIndex(node, env));
    case 'field': return located(node, () => callValue(fieldFunc(node, env), [evaluate(node.obj, env)], {}));
    case 'lambda': return makeClosure(null, [{ params: node.params, body: node.body }], env);
    case 'bin': return evalBin(node, env);
    case 'chain': return located(node, () => {
      const vals = node.args.map((a) => evaluate(a, env));
      return node.ops.every((op, i) => binop(op, vals[i], vals[i + 1]));
    });
    case 'un': return located(node, () => {
      const v = evaluate(node.e, env);
      if (node.op === 'not') return !toBool(v, 'operando de not');
      return negate(v);
    });
    case 'if': {
      const c = located(node.c, () => toBool(evaluate(node.c, env)));
      return evaluate(c ? node.a : node.b, env);
    }
    case 'let': {
      const e = env.child();
      bindDefs(node.binds, e);
      return evaluate(node.body, e);
    }
    case 'match': return evalMatch(node, env);
    case 'with': return evalWith(node, env);
    case 'spread': throw new CauchyError('"..." fora de lista ou chamada', node.pos, node.end);
    case 'def': case 'fun':
      throw new CauchyError('definição fora de lugar', node.pos, node.end);
  }
  throw new CauchyError(`nó desconhecido: ${node.k}`, node.pos, node.end);
}

function evalItems(items, env) {
  const out = [];
  for (const it of items) {
    if (it.k === 'spread') {
      const v = evaluate(it.e, env);
      out.push(...iterable(v, it));
    } else out.push(evaluate(it, env));
  }
  return out;
}

export function iterable(v, node) {
  if (Array.isArray(v)) return v;
  if (v instanceof Tuple) return v.items;
  if (typeof v === 'string') return [...v];
  const err = new CauchyError('valor não iterável');
  if (node) { err.pos = node.pos; err.end = node.end; }
  throw err;
}

const MAX_RANGE = 10_000_000;

function evalRange(node, env) {
  const a = evaluate(node.from, env);
  const b = evaluate(node.to, env);
  const s = node.step ? evaluate(node.step, env) : int(1);
  return range(a, b, s);
}

export function range(a, b, s) {
  if (!(a instanceof Elem) || !(b instanceof Elem) || !(s instanceof Elem)) fail('limites do intervalo devem ser números');
  if (a.ring === ZZ && b.ring === ZZ && s.ring === ZZ) {
    const x0 = ZZ.toSmall(a), x1 = ZZ.toSmall(b), st = ZZ.toSmall(s);
    if (x0 !== null && x1 !== null && st !== null) {
      if (st === 0) fail('passo zero');
      const n = Math.floor((x1 - x0) / st) + 1;
      if (n > MAX_RANGE) fail('intervalo grande demais');
      const out = [];
      for (let i = 0; i < n; i++) out.push(int(x0 + i * st));
      return out;
    }
  }
  if (equal(s, int(0))) fail('passo zero');
  const up = compare(s, int(0), '>');
  const out = [];
  let x = a;
  while (up ? compare(x, b, '<=') : compare(x, b, '>=')) {
    out.push(x);
    if (out.length > MAX_RANGE) fail('intervalo grande demais');
    x = add(x, s);
  }
  return out;
}

function evalComp(node, env) {
  const out = [];
  const loop = (k, e) => {
    if (k === node.clauses.length) {
      out.push(evaluate(node.expr, e));
      return;
    }
    const c = node.clauses[k];
    if (c.k === 'gen') {
      const src = iterable(evaluate(c.src, e), c.src);
      for (const v of src) {
        const e2 = e.child();
        if (!matchPattern(c.pat, v, e2)) continue;
        loop(k + 1, e2);
      }
    } else if (located(c.cond, () => toBool(evaluate(c.cond, e), 'filtro'))) {
      loop(k + 1, e);
    }
  };
  loop(0, env);
  return out;
}

function evalMatrix(node, env) {
  const rows = node.rows.map((r) => evalItems(r, env));
  return matrixFromRows(rows);
}

export function matrixFromRows(rows) {
  let base = null;
  for (const r of rows) {
    for (const x of r) {
      if (!(x instanceof Elem) || x.ring instanceof MatSpace) fail('entradas de matriz devem ser escalares ou polinômios');
      base = base ? commonRing(base, x.ring) : x.ring;
    }
  }
  if (!base) base = ZZ;
  return Mat(base).fromRows(rows);
}

function evalIndex(node, env) {
  const obj = evaluate(node.obj, env);
  // R[x] ou R[x, y, ...]: anel de polinômios; os índices são nomes, não valores.
  if (obj instanceof Ring) {
    if (!node.idx.length || node.idx.some((i) => i.k !== 'var')) fail('use R[x] ou R[x, y, ...] com nomes de variáveis');
    let order = 'degrevlex';
    for (const kw of node.kwargs ?? []) {
      if (kw.name !== 'order') fail(`opção desconhecida em R[...]: ${kw.name}`);
      order = evaluate(kw.expr, env);
      if (typeof order !== 'string') fail('order deve ser "lex", "deglex" ou "degrevlex"');
    }
    return MPoly(obj, node.idx.map((i) => i.name), order);
  }
  if (node.kwargs?.length) fail('opções nomeadas só valem em R[x, ...]');
  const idx = node.idx.map((i) => evaluate(i, env));
  return index(obj, idx);
}

function normIndex(i, n) {
  let k = toInt(i, 'índice');
  if (k < 0) k = n + k + 1;
  if (k < 1 || k > n) fail(`índice ${toInt(i)} fora do intervalo 1..${n}`);
  return k - 1;
}

export function index(obj, idx) {
  if (Array.isArray(obj) || typeof obj === 'string' || obj instanceof Tuple) {
    const items = obj instanceof Tuple ? obj.items : obj;
    if (idx.length !== 1) fail('índice único esperado');
    if (Array.isArray(idx[0])) return idx[0].map((i) => items[normIndex(i, items.length)]);
    return items[normIndex(idx[0], items.length)];
  }
  if (obj instanceof Elem && obj.ring instanceof MatSpace) {
    const R = obj.ring;
    if (idx.length === 2) {
      return R.entry(obj, normIndex(idx[0], R.nrows(obj)), normIndex(idx[1], R.ncols(obj)));
    }
    if (idx.length === 1) {
      const i = normIndex(idx[0], R.nrows(obj));
      return R.fromRows([R.rows(obj)[i]]);
    }
  }
  if (obj instanceof Elem && obj.ring instanceof MPolyRing) fail('use coeff(p, monômio) para coeficientes de polinômios em várias variáveis');
  if (obj instanceof Elem && obj.ring instanceof PolyRing) {
    // p[i] = coeficiente de x^i
    const i = toInt(idx[0], 'índice');
    if (i < 0) fail('índice negativo');
    return obj.ring.coeff(obj, i);
  }
  fail('valor não indexável');
}

// ------------------------------------------------------------- operadores

function evalBin(node, env) {
  if (node.op === 'and') {
    return located(node, () => toBool(evaluate(node.l, env), 'operando de and') && toBool(evaluate(node.r, env), 'operando de and'));
  }
  if (node.op === 'or') {
    return located(node, () => toBool(evaluate(node.l, env), 'operando de or') || toBool(evaluate(node.r, env), 'operando de or'));
  }
  const l = evaluate(node.l, env);
  const r = evaluate(node.r, env);
  return located(node, () => binop(node.op, l, r));
}

function negate(v) {
  if (v instanceof Elem) return neg(v);
  if (Array.isArray(v)) return v.map(negate);
  fail('negação de valor não numérico');
}

export function binop(op, l, r) {
  if (op === '==') return valuesEqual(l, r);
  if (op === '!=') return !valuesEqual(l, r);
  if (op === '∘') {
    const f = new Func(null, null, (args, kw) => callValue(l, [callValue(r, args, kw)], {}));
    f.parts = [l, r];
    return f;
  }
  if (l instanceof Graphic || r instanceof Graphic) {
    const a = asGraphic(l), b = asGraphic(r);
    if (op === '+' && a && b) return a.concat(b);
    fail(`operador ${op} não se aplica a ${typeName(l)} e ${typeName(r)}`);
  }
  if (typeof l === 'string' || typeof r === 'string') {
    if (op === '+') return toStr(l) + toStr(r);
    if (op === '*' && typeof l === 'string' && r instanceof Elem) return l.repeat(toInt(r));
    if (['<', '<=', '>', '>='].includes(op) && typeof l === 'string' && typeof r === 'string') {
      return op === '<' ? l < r : op === '<=' ? l <= r : op === '>' ? l > r : l >= r;
    }
    fail(`operador ${op} não se aplica a strings`);
  }
  if (Array.isArray(l) || Array.isArray(r)) return listOp(op, l, r);
  if (!(l instanceof Elem) || !(r instanceof Elem)) {
    fail(`operador ${op} não se aplica a ${typeName(l)} e ${typeName(r)}`);
  }
  switch (op) {
    case '+': return add(l, r);
    case '-': return sub(l, r);
    case '*': return mul(l, r);
    case '/': return div(l, r);
    case '//': return floorDiv(l, r);
    case '%': return mod(l, r);
    case '^': return pow(l, r);
    case '<': case '<=': case '>': case '>=': return compare(l, r, op);
  }
  fail(`operador desconhecido ${op}`);
}

// Listas: + concatena; escalares operam elemento a elemento (vetorização).
function listOp(op, l, r) {
  if (op === '+' && Array.isArray(l) && Array.isArray(r)) return [...l, ...r];
  if (Array.isArray(l) && Array.isArray(r)) {
    if (l.length !== r.length) fail('listas de tamanhos diferentes');
    return l.map((x, i) => binop(op, x, r[i]));
  }
  if (Array.isArray(l)) return l.map((x) => binop(op, x, r));
  return r.map((x) => binop(op, l, x));
}

export function valuesEqual(a, b) {
  if (a instanceof Elem && b instanceof Elem) return equal(a, b);
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => valuesEqual(x, b[i]));
  }
  if (a instanceof Tuple && b instanceof Tuple) {
    return a.items.length === b.items.length && a.items.every((x, i) => valuesEqual(x, b.items[i]));
  }
  return a === b;
}

export function typeName(v) {
  if (v instanceof Elem) return String(v.ring);
  if (Array.isArray(v)) return 'lista';
  if (v instanceof Tuple) return 'tupla';
  if (typeof v === 'string') return 'string';
  if (typeof v === 'boolean') return 'booleano';
  if (v instanceof Func) return 'função';
  if (v instanceof Ring) return 'anel';
  if (v instanceof Graphic) return 'gráfico';
  return typeof v;
}

let toStrImpl = (v) => String(v);
export function setToStr(f) {
  toStrImpl = f;
}
export function toStr(v) {
  return typeof v === 'string' ? v : toStrImpl(v);
}

// ----------------------------------------------------------------- chamadas

function fieldFunc(node, env) {
  const f = env.lookup(node.name);
  if (f === undefined) fail(`nome não definido: ${node.name}`);
  return f;
}

function evalCall(node, env) {
  let fn;
  let args;
  if (node.fn.k === 'field') {
    // Sintaxe de método: x.f(a) = f(x, a)
    const obj = evaluate(node.fn.obj, env);
    fn = located(node.fn, () => fieldFunc(node.fn, env));
    args = [obj, ...evalItems(node.args, env)];
  } else {
    fn = evaluate(node.fn, env);
    if (fn instanceof Func && fn.lazy) {
      return located(node, () => fn.impl(node.args, node.kwargs, env));
    }
    args = evalItems(node.args, env);
  }
  const kwargs = {};
  for (const kw of node.kwargs) kwargs[kw.name] = evaluate(kw.expr, env);
  return located(node, () => callValue(fn, args, kwargs));
}

export function callValue(fn, args, kwargs = {}) {
  if (fn instanceof Func) {
    if (fn.arity !== null && fn.arity !== undefined && args.length !== fn.arity && !fn.variadic) {
      const name = fn.name ?? 'função';
      fail(`${name} espera ${fn.arity} argumento${fn.arity === 1 ? '' : 's'}, recebeu ${args.length}`);
    }
    return fn.impl(args, kwargs);
  }
  if (fn instanceof Ring) return ringCall(fn, args, kwargs);
  if (fn instanceof Elem && fn.ring instanceof PolyRing) {
    if (args.length !== 1) fail('avaliação de polinômio espera 1 argumento');
    return evalPoly(fn, args[0]);
  }
  if (fn instanceof Elem && fn.ring instanceof MPolyRing) {
    const n = fn.ring.nvars;
    if (args.length !== n) fail(`polinômio em ${n} variáveis (${fn.ring.vars.join(', ')}) espera ${n} argumentos, recebeu ${args.length}`);
    return evalPoly(fn, args);
  }
  if (Array.isArray(fn) || fn instanceof Elem && fn.ring instanceof MatSpace) return index(fn, args);
  fail(`${typeName(fn)} não é uma função`);
}

let ringCallImpl = null;
let evalPolyImpl = null;
export function setRingCall(f) { ringCallImpl = f; }
export function setEvalPoly(f) { evalPolyImpl = f; }
function ringCall(R, args, kwargs) { return ringCallImpl(R, args, kwargs); }
function evalPoly(p, x) { return evalPolyImpl(p, x); }

// Função definida por cláusulas: [{params, body}], com closure sobre env.
export function makeClosure(name, clauses, env) {
  const arity = clauses[0].params.length;
  for (const c of clauses) {
    if (c.params.length !== arity) fail(`cláusulas de ${name} com números de parâmetros diferentes`);
  }
  const f = new Func(name, arity, (args) => {
    for (const c of clauses) {
      const e = new Env(env);
      if (c.params.every((p, i) => matchPattern(p, args[i], e))) {
        return evaluate(c.body, e);
      }
    }
    fail(`nenhuma cláusula de ${name ?? 'função'} corresponde aos argumentos`);
  });
  f.env = env;
  return f;
}

// --------------------------------------------------------------- padrões

export function matchPattern(p, v, env) {
  switch (p.k) {
    case 'pwild': return true;
    case 'pvar': env.set(p.name, v); return true;
    case 'plit': return valuesEqual(evaluate(p.lit, env), v);
    case 'ptuple': {
      const items = v instanceof Tuple ? v.items : null;
      if (!items || items.length !== p.items.length) return false;
      return p.items.every((q, i) => matchPattern(q, items[i], env));
    }
    case 'plist': {
      if (!Array.isArray(v)) return false;
      if (p.rest ? v.length < p.items.length : v.length !== p.items.length) return false;
      if (!p.items.every((q, i) => matchPattern(q, v[i], env))) return false;
      return p.rest ? matchPattern(p.rest, v.slice(p.items.length), env) : true;
    }
  }
  return false;
}

export function patternNames(p, out = []) {
  switch (p.k) {
    case 'pvar': out.push(p.name); break;
    case 'ptuple': case 'plist':
      p.items.forEach((q) => patternNames(q, out));
      if (p.rest) patternNames(p.rest, out);
      break;
  }
  return out;
}

function evalMatch(node, env) {
  const v = evaluate(node.e, env);
  for (const arm of node.arms) {
    const e = env.child();
    if (!matchPattern(arm.pat, v, e)) continue;
    if (arm.guard && !located(arm.guard, () => toBool(evaluate(arm.guard, e), 'guarda'))) continue;
    return evaluate(arm.body, e);
  }
  throw new CauchyError('nenhum caso do match corresponde ao valor', node.pos, node.end);
}

function evalWith(node, env) {
  const F = flint();
  let prec = F.prec;
  for (const o of node.opts) {
    const v = evaluate(o.expr, env);
    if (o.name === 'prec') prec = toInt(v, 'prec');
    else if (o.name === 'digits') prec = Math.ceil(toInt(v, 'digits') * 3.3219280948873622) + 4;
    else throw new CauchyError(`opção desconhecida em with: ${o.name}`, node.pos, node.end);
  }
  if (prec < 2 || prec > 10_000_000) throw new CauchyError('precisão fora do intervalo', node.pos, node.end);
  return F.withPrec(prec, () => evaluate(node.body, env));
}

// ---------------------------------------------------------- declarações

// Avalia definições em sequência, agrupando cláusulas consecutivas de função.
export function bindDefs(defs, env) {
  let last = UNIT;
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    if (d.k === 'fun') {
      const clauses = [{ params: d.params, body: d.body }];
      while (i + 1 < defs.length && defs[i + 1].k === 'fun' && defs[i + 1].name === d.name) {
        i++;
        clauses.push({ params: defs[i].params, body: defs[i].body });
      }
      last = located(d, () => makeClosure(d.name, clauses, env));
      env.set(d.name, last);
    } else if (d.k === 'def') {
      const raw = evaluate(d.expr, env);
      const v = raw instanceof Widget ? raw.value : raw;
      if (!matchPattern(d.pat, v, env)) throw new CauchyError('o valor não corresponde ao padrão', d.pos, d.end);
      last = raw;
    } else {
      last = evaluate(d, env);
    }
  }
  return last;
}

export { coerce };
