// Biblioteca padrão da linguagem: teoria dos números, funções especiais,
// polinômios, matrizes, corpos finitos, listas, gráficos e widgets.

import {
  Elem, Ring, ZZ, QQ, RR, CC, ZmodRing, FiniteField, PolyRing, MatSpace,
  Zmod, GF, Poly, Mat, flint, commonRing, coerce, isScalarRing, finiteOr,
  add, sub, mul, div, neg, pow, compare, equal, divrem, inv, matInv, floor, ceil, sign, isZero,
} from '../runtime/rings.js';
import { Tuple, Func, Factored, Plot, Widget, UNIT } from '../runtime/values.js';
import { fail } from '../runtime/errors.js';
import { showText } from '../runtime/show.js';
import {
  Env, callValue, toInt, toBool, int, iterable, range, index, valuesEqual, typeName,
  matrixFromRows, setRingCall, setEvalPoly, setToStr, currentContext, binop,
} from './eval.js';

export const DOCS = new Map();

export function makeGlobals() {
  const env = new Env();
  const def = (name, arity, impl, doc = '') => {
    const f = new Func(name, arity, impl);
    env.set(name, f);
    if (doc) DOCS.set(name, doc);
    return f;
  };
  const alias = (name, target) => env.set(name, env.lookup(target));

  // ------------------------------------------------------------- utilidades
  const elem = (x, what = 'argumento') => {
    if (!(x instanceof Elem)) fail(`${what} deve ser um número, polinômio ou matriz (recebeu ${typeName(x)})`);
    return x;
  };
  const zz = (x, what = 'argumento') => {
    if (x instanceof Elem && x.ring === ZZ) return x;
    if (x instanceof Elem && x.ring === QQ && ZZ.toStr(QQ.den(x)) === '1') return QQ.num(x);
    if (x instanceof Elem && x.ring instanceof ZmodRing) return x.ring.lift(x);
    fail(`${what} deve ser um inteiro (recebeu ${typeName(x)})`);
  };
  const ui = (x, what) => {
    const n = toInt(x, what);
    if (n < 0) fail(`${what ?? 'argumento'} deve ser não negativo`);
    return n;
  };
  const bool = (n) => n !== 0;
  const isNum = (x) => x instanceof Elem && isScalarRing(x.ring);
  const vec = (f) => (x, ...rest) => (Array.isArray(x) ? x.map((y) => f(y, ...rest)) : f(x, ...rest));

  // Aplica função real (arb) ou complexa (acb), promovendo a CC se o
  // resultado real não for finito (ex.: log(-1), sqrt(-2)).
  const realOrComplex = (arbName, acbName) => vec((x) => {
    elem(x);
    const R = x.ring;
    if ((R === ZZ || R === QQ || R === RR) && arbName) {
      const r = RR.op(arbName, RR.coerce(x));
      return acbName ? finiteOr(r, () => CC.op(acbName, CC.coerce(x))) : r;
    }
    if ((R === CC || ((R === ZZ || R === QQ || R === RR) && !arbName)) && acbName) return CC.op(acbName, CC.coerce(x));
    fail(`função não definida para ${R}`);
  });

  const realOrComplex2 = (arbName, acbName) => (a, b) => {
    elem(a);
    elem(b);
    const R = commonRing(commonRing(a.ring, b.ring), RR);
    if (R === RR && arbName) {
      const r = RR.op(arbName, coerce(a, RR), coerce(b, RR));
      return acbName ? finiteOr(r, () => CC.op(acbName, coerce(a, CC), coerce(b, CC))) : r;
    }
    if ((R === CC || R === RR) && acbName) return CC.op(acbName, coerce(a, CC), coerce(b, CC));
    fail(`função não definida para ${R}`);
  };


  // --------------------------------------------------------- anéis
  env.set('ZZ', ZZ);
  env.set('QQ', QQ);
  env.set('RR', RR);
  env.set('CC', CC);
  env.set('ℤ', ZZ);
  env.set('ℚ', QQ);
  env.set('ℝ', RR);
  env.set('ℂ', CC);
  def('Zmod', 1, ([n]) => Zmod(zz(n)), 'Zmod(n): anel dos inteiros módulo n');
  def('GF', null, ([q, k], kw) => {
    q = zz(q);
    const v = kw.var ?? 'a';
    if (k !== undefined) return GF(q, toInt(k), v);
    // GF(p^k): detecta potência de primo
    const f = intFactor(q);
    if (f.length !== 1) fail('GF(q) requer q potência de primo');
    return GF(f[0][0], toInt(f[0][1]), v);
  }, 'GF(q) ou GF(p, k): corpo finito com q = p^k elementos; gerador via gen(F)');
  def('Mat', 1, ([R]) => {
    if (!(R instanceof Ring)) fail('Mat(R) espera um anel');
    return Mat(R);
  }, 'Mat(R): espaço de matrizes sobre R');
  def('gen', 1, ([R]) => {
    if (R instanceof PolyRing) return R.gen();
    if (R instanceof FiniteField) return R.gen();
    fail('gen espera um anel de polinômios ou corpo finito');
  }, 'gen(R): gerador de R[x] ou de GF(q)');
  def('ring', 1, ([x]) => elem(x).ring, 'ring(x): anel ao qual x pertence');
  def('base', 1, ([R]) => {
    if (R instanceof Elem) R = R.ring;
    if (R instanceof PolyRing || R instanceof MatSpace) return R.base;
    fail('base espera um anel de polinômios ou de matrizes');
  }, 'base(R): anel de coeficientes');
  def('characteristic', 1, ([R]) => {
    if (R instanceof ZmodRing) return R.n;
    if (R instanceof FiniteField) return R.p;
    if (R instanceof PolyRing || R instanceof MatSpace) return env.lookup('characteristic').impl([R.base]);
    return int(0);
  }, 'characteristic(R)');
  def('order', 1, ([x]) => {
    if (x instanceof FiniteField) return pow(x.p, int(x.k));
    if (x instanceof ZmodRing) return x.n;
    if (x instanceof Elem && x.ring instanceof FiniteField) return x.ring.op('fq_order', x);
    if (x instanceof Elem && x.ring instanceof ZmodRing) return zmodOrder(x);
    fail('order espera um corpo finito, Z/nZ ou elemento');
  }, 'order(F) = |F|; order(a) = ordem multiplicativa de a');
  def('modulus', 1, ([R]) => {
    if (R instanceof Elem) R = R.ring;
    if (R instanceof ZmodRing) return R.n;
    if (R instanceof FiniteField) {
      const P = Poly(ZZ, 'x');
      return P.wrap(flint().raw('fqctx_modulus', R.ctx));
    }
    fail('modulus espera Z/nZ ou GF(q)');
  }, 'modulus(R): n de Z/nZ ou polinômio de definição de GF(q)');
  def('lift', 1, ([x]) => {
    if (x instanceof Elem && x.ring instanceof ZmodRing) return x.ring.lift(x);
    if (x instanceof Elem && x.ring instanceof FiniteField) return x.ring.opTo(Poly(ZZ, 'x'), 'fq_to_poly', x);
    if (x instanceof Elem && x.ring instanceof PolyRing && x.ring.base instanceof ZmodRing) {
      return x.ring.opTo(Poly(ZZ, x.ring.v), 'zmod_poly_lift', x);
    }
    if (x instanceof Elem && x.ring instanceof MatSpace && x.ring.base instanceof ZmodRing) {
      return Mat(ZZ).fromRows(x.ring.rows(x).map((r) => r.map((e) => x.ring.base.lift(e))));
    }
    fail('lift espera elemento de Z/nZ, GF(q) ou polinômio/matriz sobre Z/nZ');
  }, 'lift(x): representante inteiro (ou polinomial)');

  // --------------------------------------------------------- aritmética
  def('abs', 1, ([x]) => vec((x) => {
    elem(x);
    if (x.ring === ZZ) return ZZ.op('fmpz_abs', x);
    if (x.ring === QQ) return QQ.op('fmpq_abs', x);
    if (x.ring === RR) return RR.op('arb_abs', x);
    if (x.ring === CC) return CC.opTo(RR, 'acb_abs', x);
    fail(`abs não definido em ${x.ring}`);
  })(x), 'abs(x): valor absoluto');
  def('sign', 1, ([x]) => int(sign(elem(x))), 'sign(x): -1, 0 ou 1');
  def('floor', 1, ([x]) => vec(floor)(x), 'floor(x): maior inteiro ≤ x');
  def('ceil', 1, ([x]) => vec(ceil)(x), 'ceil(x): menor inteiro ≥ x');
  def('round', 1, ([x]) => vec((x) => floor(add(x, QQ.frac(int(1), int(2)))))(x), 'round(x): inteiro mais próximo');
  def('num', 1, ([x]) => (x.ring === QQ ? QQ.num(x) : zz(x)), 'num(q): numerador');
  def('den', 1, ([x]) => (x.ring === QQ ? QQ.den(x) : int(1)), 'den(q): denominador');
  def('mod', 2, ([a, b]) => binop('%', a, b), 'mod(a, b) = a % b');
  def('div', 2, ([a, b]) => binop('//', a, b), 'div(a, b) = a // b (quociente com piso)');
  def('divrem', 2, ([a, b]) => new Tuple(divrem(elem(a), elem(b))), 'divrem(a, b) = (q, r) com a = q·b + r');
  def('quo', 2, ([a, b]) => divrem(elem(a), elem(b))[0], 'quo(a, b): quociente euclidiano');
  def('rem', 2, ([a, b]) => divrem(elem(a), elem(b))[1], 'rem(a, b): resto euclidiano');
  def('inv', 1, ([x]) => inv(elem(x)), 'inv(x): inverso multiplicativo');

  // --------------------------------------------------------- teoria dos números
  const intFactor = (n) => {
    const v = flint().vec(flint().raw('fmpz_factor', n.ptr)).map((p) => ZZ.wrap(p));
    const out = new Factored();
    for (let i = 1; i < v.length; i += 2) out.push([v[i], v[i + 1]]);
    out.unit = v[0];
    return out;
  };
  const factored = (list, unit) => {
    const out = new Factored();
    for (const [b, e] of list) out.push(new Tuple([b, e]));
    out.unit = unit;
    return out;
  };
  const zmodOrder = (x) => {
    const R = x.ring;
    if (ZZ.cmp(ZZ.op('fmpz_gcd', R.lift(x), R.n), int(1)) !== 0) fail('elemento não inversível');
    const phi = ZZ.op('fmpz_euler_phi', R.n);
    let r = phi;
    for (const [p, e] of intFactor(phi)) {
      for (let k = 0; k < toInt(e); k++) {
        const t = ZZ.op('fmpz_divexact', r, p);
        if (equal(pow(x, t), R.one())) r = t;
        else break;
      }
    }
    return r;
  };

  def('factor', 1, ([x]) => {
    elem(x);
    const R = x.ring;
    if (R === ZZ) {
      const f = intFactor(x);
      return factored(f, f.unit);
    }
    if (R === QQ) {
      const a = intFactor(QQ.num(x));
      const b = isZero(sub(QQ.den(x), int(1))) ? [] : intFactor(QQ.den(x));
      const all = [...a, ...b.map(([p, e]) => [p, ZZ.neg(e)])];
      all.sort((u, v) => ZZ.cmp(u[0], v[0]));
      return factored(all, a.unit);
    }
    if (R instanceof PolyRing) return polyFactor(x);
    fail(`factor não suportado em ${R}`);
  }, 'factor(x): fatoração de inteiro, racional ou polinômio');

  const polyFactor = (p) => {
    const R = p.ring;
    const F = flint();
    let fn, unitRing, outRing = R;
    switch (R.tag) {
      case 'fmpz_poly': fn = 'fmpz_poly_factor'; unitRing = ZZ; break;
      case 'fmpq_poly': fn = 'fmpq_poly_factor'; unitRing = QQ; break;
      case 'zmod_poly': fn = 'zmod_poly_factor'; unitRing = R.base; break;
      case 'fq_poly': fn = 'fq_poly_factor'; unitRing = R.base; break;
      default: fail(`factor não suportado em ${R}`);
    }
    const v = F.vec(F.raw(fn, p.ptr, R.ctx));
    const unit = unitRing.wrap(v[0]);
    const list = [];
    for (let i = 1; i < v.length; i += 2) list.push([outRing.wrap(v[i]), ZZ.wrap(v[i + 1])]);
    return factored(list, unit);
  };

  def('isprime', 1, ([n]) => vec((n) => bool(ZZ.op('fmpz_is_prime', zz(n))))(n), 'isprime(n): primalidade (provada)');
  def('isprobprime', 1, ([n]) => bool(ZZ.op('fmpz_is_probabprime', zz(n))), 'isprobprime(n): teste BPSW');
  def('nextprime', 1, ([n]) => ZZ.op('fmpz_nextprime', zz(n), 1), 'nextprime(n): menor primo > n');
  def('prevprime', 1, ([n]) => {
    let m = sub(zz(n), int(1));
    while (compare(m, int(2), '>=')) {
      if (bool(ZZ.op('fmpz_is_prime', m))) return m;
      m = sub(m, int(1));
    }
    fail('não há primo menor');
  }, 'prevprime(n): maior primo < n');
  def('prime', 1, ([n]) => int(ZZ.op('n_nth_prime', ui(n, 'n'))), 'prime(n): n-ésimo primo');
  def('primepi', 1, ([n]) => int(ZZ.op('n_prime_pi', ui(n, 'n'))), 'primepi(x): número de primos ≤ x');
  def('primes', null, ([a, b]) => {
    let lo = b === undefined ? int(2) : zz(a);
    const hi = b === undefined ? zz(a) : zz(b);
    const out = [];
    let p = compare(lo, int(2), '<') ? int(2) : lo;
    if (!bool(ZZ.op('fmpz_is_prime', p))) p = ZZ.op('fmpz_nextprime', p, 1);
    while (compare(p, hi, '<=')) {
      out.push(p);
      p = ZZ.op('fmpz_nextprime', p, 1);
    }
    return out;
  }, 'primes(n) ou primes(a, b): lista de primos');
  def('gcd', null, (args) => {
    const xs = args.length === 1 ? iterable(args[0]) : args;
    return xs.reduce((a, b) => gcd2(elem(a), elem(b)));
  }, 'gcd(a, b, ...): máximo divisor comum');
  def('lcm', null, (args) => {
    const xs = args.length === 1 ? iterable(args[0]) : args;
    return xs.reduce((a, b) => lcm2(elem(a), elem(b)));
  }, 'lcm(a, b, ...): mínimo múltiplo comum');
  const gcd2 = (a, b) => {
    const R = commonRing(a.ring, b.ring);
    a = coerce(a, R); b = coerce(b, R);
    if (R === ZZ) return ZZ.op('fmpz_gcd', a, b);
    if (R instanceof PolyRing && R.has('gcd')) return R.op(`${R.tag}_gcd`, a, b);
    fail(`gcd não suportado em ${R}`);
  };
  const lcm2 = (a, b) => {
    const R = commonRing(a.ring, b.ring);
    a = coerce(a, R); b = coerce(b, R);
    if (R === ZZ) return ZZ.op('fmpz_lcm', a, b);
    if (R instanceof PolyRing && R.has('lcm')) return R.op(`${R.tag}_lcm`, a, b);
    if (R instanceof PolyRing) return div(mul(a, b), gcd2(a, b));
    fail(`lcm não suportado em ${R}`);
  };
  def('xgcd', 2, ([a, b]) => {
    const F = flint();
    return new Tuple(F.vec(F.raw('fmpz_xgcd', zz(a).ptr, zz(b).ptr)).map((p) => ZZ.wrap(p)));
  }, 'xgcd(a, b) = (g, s, t) com g = s·a + t·b');
  def('powmod', 3, ([a, e, m]) => {
    if (ZZ.sgn(zz(e)) < 0) return ZZ.op('fmpz_powm', ZZ.op('fmpz_invmod', zz(a), zz(m)), ZZ.neg(e), zz(m));
    return ZZ.op('fmpz_powm', zz(a), zz(e), zz(m));
  }, 'powmod(a, e, m) = a^e mod m');
  def('invmod', 2, ([a, m]) => ZZ.op('fmpz_invmod', zz(a), zz(m)), 'invmod(a, m): inverso de a módulo m');
  def('factorial', 1, ([n]) => vec((n) => {
    if (n instanceof Elem && n.ring !== ZZ) return env.lookup('gamma').impl([add(n, int(1))]);
    return ZZ.op('fmpz_fac_ui', ui(n, 'n'));
  })(n), 'factorial(n) = n!');
  def('binomial', 2, ([n, k]) => {
    const nz = zz(n), kz = zz(k);
    if (ZZ.sgn(kz) < 0) return int(0);
    if (ZZ.sgn(nz) >= 0) return ZZ.op('fmpz_bin_uiui', ui(nz), ui(kz));
    // binomial(-n, k) = (-1)^k binomial(n+k-1, k)
    const r = ZZ.op('fmpz_bin_uiui', ui(add(neg(nz), sub(kz, int(1)))), ui(kz));
    return toInt(kz) % 2 ? neg(r) : r;
  }, 'binomial(n, k): coeficiente binomial');
  def('fib', 1, ([n]) => vec((n) => ZZ.op('fmpz_fib_ui', ui(n, 'n')))(n), 'fib(n): número de Fibonacci');
  def('lucas', 1, ([n]) => {
    const k = ui(n, 'n');
    return add(ZZ.op('fmpz_fib_ui', k + 1), k === 0 ? int(1) : ZZ.op('fmpz_fib_ui', k - 1));
  }, 'lucas(n): número de Lucas');
  def('primorial', 1, ([n]) => ZZ.op('fmpz_primorial', ui(n, 'n')), 'primorial(n): produto dos primos ≤ n');
  def('eulerphi', 1, ([n]) => vec((n) => ZZ.op('fmpz_euler_phi', zz(n)))(n), 'eulerphi(n): função φ de Euler');
  alias('φ', 'eulerphi');
  def('moebius', 1, ([n]) => vec((n) => int(ZZ.op('fmpz_moebius_mu', zz(n))))(n), 'moebius(n): função μ de Möbius');
  alias('μ', 'moebius');
  def('sigma', null, ([n, k]) => ZZ.op('fmpz_divisor_sigma', k === undefined ? 1 : ui(k), zz(n)), 'sigma(n, k=1): soma das k-ésimas potências dos divisores');
  def('divisors', 1, ([n]) => {
    let ds = [int(1)];
    for (const [p, e] of intFactor(ZZ.op('fmpz_abs', zz(n)))) {
      const next = [];
      let pk = int(1);
      for (let k = 0; k <= toInt(e); k++) {
        for (const d of ds) next.push(mul(d, pk));
        pk = mul(pk, p);
      }
      ds = next;
    }
    return ds.sort((a, b) => ZZ.cmp(a, b));
  }, 'divisors(n): divisores positivos em ordem');
  def('numdivisors', 1, ([n]) => ZZ.op('fmpz_divisor_sigma', 0, zz(n)), 'numdivisors(n)');
  def('jacobi', 2, ([a, n]) => int(ZZ.op('fmpz_jacobi', zz(a), zz(n))), 'jacobi(a, n): símbolo de Jacobi');
  def('isqrt', 1, ([n]) => ZZ.op('fmpz_sqrt', zz(n)), 'isqrt(n): ⌊√n⌋');
  def('iroot', 2, ([n, k]) => ZZ.op('fmpz_root', zz(n), toInt(k)), 'iroot(n, k): ⌊n^(1/k)⌋');
  def('issquare', 1, ([n]) => bool(ZZ.op('fmpz_is_square', zz(n))), 'issquare(n)');
  def('iseven', 1, ([n]) => bool(ZZ.op('fmpz_is_even', zz(n))), 'iseven(n)');
  def('isodd', 1, ([n]) => bool(ZZ.op('fmpz_is_odd', zz(n))), 'isodd(n)');
  def('divides', 2, ([d, n]) => bool(ZZ.op('fmpz_divisible', zz(n), zz(d))), 'divides(d, n): d divide n?');
  def('valuation', 2, ([n, p]) => {
    let k = 0;
    let m = zz(n);
    if (ZZ.isZero(m)) fail('valuation(0, p) é infinito');
    while (bool(ZZ.op('fmpz_divisible', m, zz(p)))) {
      m = ZZ.op('fmpz_divexact', m, p);
      k++;
    }
    return int(k);
  }, 'valuation(n, p): expoente de p em n');
  def('digits', null, ([n, b]) => {
    const base = b === undefined ? 10 : toInt(b);
    if (base < 2 || base > 62) fail('base entre 2 e 62');
    const s = ZZ.toStr(ZZ.op('fmpz_abs', zz(n)), base);
    return [...s].reverse().map((c) => int(parseInt(c, 36) || (c >= 'a' ? c.charCodeAt(0) - 61 : 0)));
  }, 'digits(n, b=10): dígitos de n na base b, do menos significativo');
  def('numdigits', null, ([n, b]) => {
    const s = ZZ.toStr(ZZ.op('fmpz_abs', zz(n)), b === undefined ? 10 : toInt(b));
    return int(s.length);
  }, 'numdigits(n, b=10)');
  def('bits', 1, ([n]) => int(ZZ.op('fmpz_bits', zz(n))), 'bits(n): tamanho em bits');
  def('tobase', 2, ([n, b]) => ZZ.toStr(zz(n), toInt(b)), 'tobase(n, b): string de n na base b');
  def('frombase', 2, ([s, b]) => ZZ.fromString(String(s), toInt(b)), 'frombase(s, b): inteiro a partir de string');
  def('partitions', 1, ([n]) => vec((n) => ZZ.op('fmpz_numbpart', zz(n)))(n), 'partitions(n): número de partições p(n)');
  def('bell', 1, ([n]) => ZZ.op('fmpz_bell', ui(n, 'n')), 'bell(n): número de Bell');
  def('stirling1', 2, ([n, k]) => ZZ.op('fmpz_stirling1', ui(n), ui(k)), 'stirling1(n, k): Stirling de 1ª espécie (com sinal)');
  def('stirling2', 2, ([n, k]) => ZZ.op('fmpz_stirling2', ui(n), ui(k)), 'stirling2(n, k): Stirling de 2ª espécie');
  def('eulernumber', 1, ([n]) => ZZ.op('fmpz_euler_number', ui(n, 'n')), 'eulernumber(n): número de Euler');
  def('bernoulli', 1, ([n]) => vec((n) => QQ.op('fmpq_bernoulli', ui(n, 'n')))(n), 'bernoulli(n): número de Bernoulli B_n');
  def('harmonic', 1, ([n]) => QQ.op('fmpq_harmonic_ui', ui(n, 'n')), 'harmonic(n): H_n = 1 + 1/2 + … + 1/n');
  def('dedekindsum', 2, ([h, k]) => QQ.op('fmpq_dedekind_sum', zz(h), zz(k)), 'dedekindsum(h, k)');
  def('random', 1, ([n]) => ZZ.op('fmpz_randtest', zz(n)), 'random(n): inteiro aleatório em [0, n)');

  // --------------------------------------------------------- reais e complexos
  const sqrtExact = (x) => {
    if (x.ring === ZZ && ZZ.sgn(x) >= 0 && bool(ZZ.op('fmpz_is_square', x))) return ZZ.op('fmpz_sqrt', x);
    if (x.ring === QQ && QQ.sgn(x) >= 0) {
      const n = QQ.num(x), d = QQ.den(x);
      if (bool(ZZ.op('fmpz_is_square', n)) && bool(ZZ.op('fmpz_is_square', d))) {
        return QQ.frac(ZZ.op('fmpz_sqrt', n), ZZ.op('fmpz_sqrt', d));
      }
    }
    return null;
  };
  const rcSqrt = realOrComplex('arb_sqrt', 'acb_sqrt');
  def('sqrt', 1, ([x]) => vec((x) => {
    elem(x);
    if (x.ring instanceof ZmodRing) return x.ring.op('zmod_sqrt', x);
    if (x.ring instanceof FiniteField) return x.ring.op('fq_sqrt', x);
    return sqrtExact(x) ?? rcSqrt(x);
  })(x), 'sqrt(x): raiz quadrada (exata quando possível)');
  def('cbrt', 1, ([x]) => {
    elem(x);
    if (x.ring === ZZ) {
      const r = ZZ.op('fmpz_root', x, 3);
      if (equal(pow(r, int(3)), x)) return r;
    }
    if (x.ring === CC) return CC.op('acb_root_ui', x, 3);
    if (sign(x) < 0) return neg(RR.op('arb_root_ui', RR.coerce(neg(x)), 3));
    return RR.op('arb_root_ui', RR.coerce(x), 3);
  }, 'cbrt(x): raiz cúbica real');
  def('root', 2, ([x, k]) => {
    const n = ui(k, 'k');
    if (x.ring === CC) return CC.op('acb_root_ui', x, n);
    return finiteOr(RR.op('arb_root_ui', RR.coerce(elem(x)), n), () => CC.op('acb_root_ui', CC.coerce(x), n));
  }, 'root(x, k): raiz k-ésima principal');
  def('exp', 1, ([x]) => realOrComplex('arb_exp', 'acb_exp')(x), 'exp(x)');
  def('expm1', 1, ([x]) => realOrComplex('arb_expm1', null)(x), 'expm1(x) = exp(x) - 1');
  def('log', null, ([x, b]) => {
    if (b === undefined) return realOrComplex('arb_log', 'acb_log')(x);
    return div(realOrComplex('arb_log', 'acb_log')(x), realOrComplex('arb_log', 'acb_log')(b));
  }, 'log(x) ou log(x, b): logaritmo natural ou na base b');
  alias('ln', 'log');
  def('log1p', 1, ([x]) => realOrComplex('arb_log1p', null)(x), 'log1p(x) = log(1 + x)');
  def('log2', 1, ([x]) => div(realOrComplex('arb_log', 'acb_log')(x), RR.op('arb_const_log2')), 'log2(x)');
  def('log10', 1, ([x]) => RR.op('arb_log_base_ui', RR.coerce(elem(x)), 10), 'log10(x)');
  for (const f of ['sin', 'cos', 'tan', 'cot', 'sinh', 'cosh', 'tanh', 'asinh', 'sinc']) {
    def(f, 1, ([x]) => realOrComplex(`arb_${f}`, `acb_${f}`)(x), `${f}(x)`);
  }
  def('sec', 1, ([x]) => realOrComplex('arb_sec', null)(x), 'sec(x)');
  def('csc', 1, ([x]) => realOrComplex('arb_csc', null)(x), 'csc(x)');
  for (const f of ['asin', 'acos', 'atan', 'acosh', 'atanh']) {
    def(f, 1, ([x]) => realOrComplex(`arb_${f}`, `acb_${f}`)(x), `${f}(x)`);
  }
  def('sinpi', 1, ([x]) => realOrComplex('arb_sin_pi', null)(x), 'sinpi(x) = sin(πx)');
  def('cospi', 1, ([x]) => realOrComplex('arb_cos_pi', null)(x), 'cospi(x) = cos(πx)');
  def('atan2', 2, ([y, x]) => RR.op('arb_atan2', RR.coerce(y), RR.coerce(x)), 'atan2(y, x)');
  def('gamma', 1, ([x]) => vec((x) => {
    if (x.ring === ZZ && ZZ.sgn(x) > 0) {
      const n = ZZ.toSmall(x);
      if (n !== null && n < 100000) return ZZ.op('fmpz_fac_ui', n - 1);
    }
    return realOrComplex('arb_gamma', 'acb_gamma')(x);
  })(x), 'gamma(x): função Γ');
  alias('Γ', 'gamma');
  def('lgamma', 1, ([x]) => realOrComplex('arb_lgamma', 'acb_lgamma')(x), 'lgamma(x) = log Γ(x)');
  def('rgamma', 1, ([x]) => realOrComplex('arb_rgamma', 'acb_rgamma')(x), 'rgamma(x) = 1/Γ(x)');
  def('digamma', 1, ([x]) => realOrComplex('arb_digamma', 'acb_digamma')(x), 'digamma(x) = ψ(x)');
  alias('ψ', 'digamma');
  def('beta', 2, ([a, b]) => div(mul(env.lookup('gamma').impl([a]), env.lookup('gamma').impl([b])), env.lookup('gamma').impl([add(a, b)])), 'beta(a, b) = Γ(a)Γ(b)/Γ(a+b)');
  def('zeta', null, ([s, a]) => {
    if (a !== undefined) return realOrComplex2('arb_hurwitz_zeta', 'acb_hurwitz_zeta')(s, a);
    return realOrComplex('arb_zeta', 'acb_zeta')(s);
  }, 'zeta(s) ou zeta(s, a): função zeta de Riemann / Hurwitz');
  alias('ζ', 'zeta');
  def('eta', 1, ([s]) => CC.op('acb_dirichlet_eta', CC.coerce(elem(s))), 'eta(s): função eta de Dirichlet');
  def('zetazero', 1, ([n]) => CC.op('acb_zeta_zero', zz(n)), 'zetazero(n): n-ésimo zero não trivial de ζ');
  def('polylog', 2, ([s, z]) => CC.op('acb_polylog', CC.coerce(elem(s)), CC.coerce(elem(z))), 'polylog(s, z) = Li_s(z)');
  def('agm', 2, ([a, b]) => realOrComplex2('arb_agm', 'acb_agm')(a, b), 'agm(a, b): média aritmético-geométrica');
  def('erf', 1, ([x]) => realOrComplex('arb_erf', 'acb_erf')(x), 'erf(x)');
  def('erfc', 1, ([x]) => realOrComplex('arb_erfc', 'acb_erfc')(x), 'erfc(x)');
  def('erfi', 1, ([x]) => realOrComplex('arb_erfi', null)(x), 'erfi(x)');
  def('ei', 1, ([x]) => realOrComplex('arb_ei', 'acb_ei')(x), 'ei(x): integral exponencial');
  def('si', 1, ([x]) => realOrComplex('arb_si', null)(x), 'si(x): seno integral');
  def('ci', 1, ([x]) => realOrComplex('arb_ci', null)(x), 'ci(x): cosseno integral');
  def('li', 1, ([x]) => realOrComplex('arb_li', null)(x), 'li(x): logaritmo integral');
  def('besselj', 2, ([n, x]) => realOrComplex2('arb_bessel_j', 'acb_bessel_j')(n, x), 'besselj(ν, x)');
  def('bessely', 2, ([n, x]) => realOrComplex2('arb_bessel_y', 'acb_bessel_y')(n, x), 'bessely(ν, x)');
  def('besseli', 2, ([n, x]) => realOrComplex2('arb_bessel_i', 'acb_bessel_i')(n, x), 'besseli(ν, x)');
  def('besselk', 2, ([n, x]) => realOrComplex2('arb_bessel_k', 'acb_bessel_k')(n, x), 'besselk(ν, x)');
  def('airyai', 1, ([x]) => realOrComplex('arb_airy_ai', 'acb_airy_ai')(x), 'airyai(x)');
  def('airybi', 1, ([x]) => realOrComplex('arb_airy_bi', 'acb_airy_bi')(x), 'airybi(x)');
  def('lambertw', null, ([x, k]) => {
    if (k === undefined && x.ring !== CC) {
      return finiteOr(RR.op('arb_lambertw', RR.coerce(elem(x))), () => CC.op('acb_lambertw', CC.coerce(x), int(0)));
    }
    return CC.op('acb_lambertw', CC.coerce(elem(x)), k === undefined ? int(0) : zz(k));
  }, 'lambertw(x) ou lambertw(x, k): função W de Lambert (ramo k)');
  def('gammainc', 2, ([s, x]) => realOrComplex2('arb_gamma_upper', 'acb_gamma_upper')(s, x), 'gammainc(s, x): Γ(s, x) incompleta superior');
  def('hyp2f1', 4, ([a, b, c, z]) => CC.op('acb_hyp2f1', ...[a, b, c, z].map((v) => CC.coerce(elem(v)))), 'hyp2f1(a, b, c, z): função hipergeométrica ₂F₁');
  def('kleinj', 1, ([t]) => CC.op('acb_modular_j', CC.coerce(elem(t))), 'kleinj(τ): invariante j');
  def('dedekindeta', 1, ([t]) => CC.op('acb_modular_eta', CC.coerce(elem(t))), 'dedekindeta(τ): η de Dedekind');
  def('modlambda', 1, ([t]) => CC.op('acb_modular_lambda', CC.coerce(elem(t))), 'modlambda(τ): função λ modular');
  def('modulardelta', 1, ([t]) => CC.op('acb_modular_delta', CC.coerce(elem(t))), 'modulardelta(τ): Δ(τ)');
  def('ellipk', 1, ([m]) => CC.op('acb_elliptic_k', CC.coerce(elem(m))), 'ellipk(m): integral elíptica completa K(m)');
  def('ellipe', 1, ([m]) => CC.op('acb_elliptic_e', CC.coerce(elem(m))), 'ellipe(m): integral elíptica completa E(m)');
  def('weierstrassp', 2, ([z, t]) => CC.op('acb_elliptic_p', CC.coerce(elem(z)), CC.coerce(elem(t))), 'weierstrassp(z, τ): ℘ de Weierstrass');
  def('barnesg', 1, ([x]) => CC.op('acb_barnes_g', CC.coerce(elem(x))), 'barnesg(z): função G de Barnes');
  def('re', 1, ([z]) => vec((z) => (z.ring === CC ? CC.re(z) : z))(z), 're(z): parte real');
  def('im', 1, ([z]) => vec((z) => (z.ring === CC ? CC.im(z) : RR.zero()))(z), 'im(z): parte imaginária');
  def('conj', 1, ([z]) => vec((z) => (z.ring === CC ? CC.op('acb_conj', z) : z))(z), 'conj(z): conjugado');
  def('arg', 1, ([z]) => RR.op('acb_arg', CC.coerce(elem(z))), 'arg(z): argumento');
  def('complex', 2, ([a, b]) => CC.fromParts(RR.coerce(elem(a)), RR.coerce(elem(b))), 'complex(a, b) = a + b·i');
  def('mid', 1, ([x]) => vec((x) => (x.ring === RR ? RR.op('arb_mid', x) : x))(x), 'mid(x): centro da bola');
  def('rad', 1, ([x]) => vec((x) => (x.ring === RR ? RR.op('arb_rad', x) : RR.zero()))(x), 'rad(x): raio da bola');
  def('interval', 2, ([a, b]) => RR.op('arb_set_interval', RR.coerce(elem(a)), RR.coerce(elem(b))), 'interval(a, b): bola contendo [a, b]');
  def('contains', 2, ([a, b]) => {
    if (Array.isArray(a)) return a.some((x) => valuesEqual(x, b));
    if (elem(a).ring === CC || elem(b).ring === CC) return bool(CC.op('acb_contains', CC.coerce(a), CC.coerce(b)));
    return bool(RR.op('arb_contains', RR.coerce(a), RR.coerce(b)));
  }, 'contains(a, b): a contém b (bolas) ou lista contém elemento');
  def('overlaps', 2, ([a, b]) => {
    if (elem(a).ring === CC || elem(b).ring === CC) return bool(CC.op('acb_overlaps', CC.coerce(a), CC.coerce(b)));
    return bool(RR.op('arb_overlaps', RR.coerce(a), RR.coerce(b)));
  }, 'overlaps(a, b): bolas se intersectam?');
  def('accuracy', 1, ([x]) => int(x.ring === CC ? CC.op('acb_rel_accuracy_bits', x) : RR.op('arb_rel_accuracy_bits', RR.coerce(elem(x)))), 'accuracy(x): bits de precisão relativa');
  def('N', null, ([x], kw) => {
    const F = flint();
    const go = () => vec((x) => {
      if (x instanceof Elem && x.ring === CC) return CC.op('acb_set_round', x);
      if (x instanceof Elem && isScalarRing(x.ring) && RR.accepts(x.ring)) return RR.op('arb_set_round', RR.coerce(x));
      if (x instanceof Elem && x.ring === RR) return RR.op('arb_set_round', x);
      if (x instanceof Elem && x.ring instanceof PolyRing) return coerce(x, Poly(x.ring.base === CC ? CC : RR, x.ring.v));
      if (x instanceof Elem && x.ring instanceof MatSpace) return coerce(x, Mat(x.ring.base === CC ? CC : RR));
      return x;
    })(x);
    if (kw.digits) return F.withPrec(Math.ceil(toInt(kw.digits) * 3.3219280948873622) + 4, go);
    if (kw.prec) return F.withPrec(toInt(kw.prec), go);
    return go();
  }, 'N(x, digits=, prec=): aproximação numérica (bola)');
  def('prec', 0, () => int(flint().prec), 'prec(): precisão de trabalho em bits');
  def('fibr', 1, ([n]) => RR.op('arb_fib', zz(n)), 'fibr(n): Fibonacci como real');

  // --------------------------------------------------------- polinômios
  const poly = (p, what = 'argumento') => {
    if (!(p instanceof Elem) || !(p.ring instanceof PolyRing)) fail(`${what} deve ser um polinômio`);
    return p;
  };
  def('deg', 1, ([p]) => {
    if (p instanceof Elem && isScalarRing(p.ring)) return int(isZero(p) ? -1 : 0);
    return int(poly(p).ring.degree(p));
  }, 'deg(p): grau (−1 para o polinômio zero)');
  alias('degree', 'deg');
  def('coeff', 2, ([p, i]) => poly(p).ring.coeff(p, ui(i, 'i')), 'coeff(p, i): coeficiente de x^i');
  def('coeffs', 1, ([p]) => poly(p).ring.coeffs(p), 'coeffs(p): coeficientes do grau 0 ao grau n');
  def('lc', 1, ([p]) => {
    const R = poly(p).ring;
    const n = R.len(p);
    return n ? R.coeff(p, n - 1) : R.base.zero();
  }, 'lc(p): coeficiente líder');
  const derivative = (p) => {
    const R = poly(p).ring;
    return R.op(`${R.tag}_derivative`, p);
  };
  def('diff', null, ([p, n]) => {
    let k = n === undefined ? 1 : ui(n, 'n');
    let r = poly(p);
    while (k-- > 0) r = derivative(r);
    return r;
  }, "diff(p, n=1): derivada n-ésima");
  alias('derivative', 'diff');
  def('integral', 1, ([p]) => {
    let R = poly(p).ring;
    if (R.base === ZZ) {
      R = Poly(QQ, R.v);
      p = coerce(p, R);
    }
    if (!R.has('integral')) fail(`integral não suportada em ${R}`);
    return R.op(`${R.tag}_integral`, p);
  }, 'integral(p): primitiva com termo constante 0');
  def('compose', 2, ([p, q]) => compose(poly(p), elem(q)), 'compose(p, q) = p(q)');
  const compose = (p, q) => {
    const R = commonRing(p.ring, q.ring);
    return R.op(`${R.tag}_compose`, coerce(p, R), coerce(q, R));
  };
  def('content', 1, ([p]) => {
    const R = poly(p).ring;
    if (R.base === ZZ) return R.op('fmpz_poly_content', p);
    if (R.base === QQ) {
      const z = R.opTo(Poly(ZZ, R.v), 'fmpq_poly_numerator', p);
      const lcm = (cs) => cs.reduce((a, c) => ZZ.op('fmpz_lcm', a, QQ.den(c)), int(1));
      const d = lcm(R.coeffs(p));
      return QQ.frac(ZZ.op('fmpz_poly_content', z), d);
    }
    fail('content requer polinômio sobre ZZ ou QQ');
  }, 'content(p): conteúdo (mdc dos coeficientes)');
  def('primitive', 1, ([p]) => {
    const R = poly(p).ring;
    if (R.base === ZZ) return R.op('fmpz_poly_primitive_part', p);
    if (R.base === QQ) return Poly(ZZ, R.v).op('fmpz_poly_primitive_part', R.opTo(Poly(ZZ, R.v), 'fmpq_poly_numerator', p));
    fail('primitive requer polinômio sobre ZZ ou QQ');
  }, 'primitive(p): parte primitiva em ZZ[x]');
  def('monic', 1, ([p]) => {
    let R = poly(p).ring;
    if (R.base === ZZ) { R = Poly(QQ, R.v); p = coerce(p, R); }
    if (R.has('make_monic')) return R.op(`${R.tag}_make_monic`, p);
    return R.scalarMul(p, inv(env.lookup('lc').impl([p])));
  }, 'monic(p): p dividido pelo coeficiente líder');
  def('disc', 1, ([p]) => {
    const R = poly(p).ring;
    if (R.base === ZZ) return R.op('fmpz_poly_discriminant', p);
    if (R.base === QQ) {
      const d = R.degree(p);
      const res = env.lookup('resultant').impl([p, derivative(p)]);
      const lc = env.lookup('lc').impl([p]);
      const s = ((d * (d - 1)) / 2) % 2 ? -1 : 1;
      return mul(div(res, lc), int(s));
    }
    fail('disc requer polinômio sobre ZZ ou QQ');
  }, 'disc(p): discriminante');
  alias('discriminant', 'disc');
  def('resultant', 2, ([p, q]) => {
    const R = commonRing(poly(p).ring, poly(q).ring);
    if (R.base === ZZ) return R.op('fmpz_poly_resultant', coerce(p, R), coerce(q, R));
    if (R.base === QQ) return R.op('fmpq_poly_resultant', coerce(p, R), coerce(q, R));
    fail('resultant requer polinômios sobre ZZ ou QQ');
  }, 'resultant(p, q)');
  def('issquarefree', 1, ([p]) => {
    if (p.ring === ZZ) return toInt(ZZ.op('fmpz_moebius_mu', p)) !== 0;
    const R = poly(p).ring;
    if (R.has('is_squarefree')) return bool(R.op(`${R.tag}_is_squarefree`, p));
    return R.degree(gcdPoly(p, derivative(p))) === 0;
  }, 'issquarefree(x)');
  const gcdPoly = (a, b) => { const R = a.ring; return R.op(`${R.tag}_gcd`, a, b); };
  def('isirreducible', 1, ([p]) => {
    const R = poly(p).ring;
    if (R.has('is_irreducible')) return bool(R.op(`${R.tag}_is_irreducible`, p));
    const f = polyFactor(p);
    return f.length === 1 && toInt(f[0].items[1]) === 1;
  }, 'isirreducible(p)');
  def('roots', null, ([p], kw) => {
    const F = flint();
    const go = () => {
      const R = poly(p).ring;
      if (R.base === ZZ || R.base === QQ) {
        const out = [];
        for (const t of polyFactor(p)) {
          const f = t.items[0];
          const z = R.base === ZZ ? f : f.ring.opTo(Poly(ZZ, R.v), 'fmpq_poly_numerator', f);
          out.push(...F.vec(F.raw('fmpz_poly_complex_roots', z.ptr, F.prec)).map((q) => CC.wrap(q)));
        }
        return out;
      }
      if (R.base === RR || R.base === CC) {
        const P = Poly(CC, R.v);
        return F.vec(F.raw('acb_poly_roots', coerce(p, P).ptr, F.prec)).map((q) => CC.wrap(q));
      }
      if (R.tag === 'zmod_poly' || R.tag === 'fq_poly') {
        const v = F.vec(F.raw(`${R.tag}_roots`, p.ptr, R.ctx));
        const out = [];
        for (let i = 0; i < v.length; i += 2) {
          out.push(R.base.wrap(v[i]));
          ZZ.wrap(v[i + 1]);
        }
        return out;
      }
      fail(`roots não suportado em ${R}`);
    };
    return kw.prec ? F.withPrec(toInt(kw.prec), go) : kw.digits ? F.withPrec(Math.ceil(toInt(kw.digits) * 3.33) + 4, go) : go();
  }, 'roots(p, prec=): raízes (complexas certificadas para ZZ/QQ; no corpo para Z/pZ e GF(q))');
  def('realroots', null, ([p], kw) => {
    const F = flint();
    const R = poly(p).ring;
    if (R.base !== ZZ && R.base !== QQ) fail('realroots requer polinômio sobre ZZ ou QQ');
    const go = () => {
      const out = [];
      for (const t of polyFactor(p)) {
        const f = t.items[0];
        const z = R.base === ZZ ? f : f.ring.opTo(Poly(ZZ, R.v), 'fmpq_poly_numerator', f);
        out.push(...F.vec(F.raw('fmpz_poly_real_roots', z.ptr, F.prec)).map((q) => RR.wrap(q)));
      }
      return out.sort((a, b) => RR.mid(a) - RR.mid(b));
    };
    return kw.prec ? F.withPrec(toInt(kw.prec), go) : go();
  }, 'realroots(p, prec=): raízes reais isoladas, em ordem');
  const special = (name, fn, R = () => Poly(ZZ, 'x')) => def(name, null, ([n], kw) => {
    const P = R();
    let p = P.op(fn, ui(n, 'n'));
    if (kw.var) p = coerce(p, Poly(P.base, String(kw.var)));
    return p;
  });
  special('cyclotomic', 'fmpz_poly_cyclotomic');
  special('chebyshevt', 'fmpz_poly_chebyshev_t');
  special('chebyshevu', 'fmpz_poly_chebyshev_u');
  special('hermiteh', 'fmpz_poly_hermite_h');
  special('swinnertondyer', 'fmpz_poly_swinnerton_dyer');
  special('cosminpoly', 'fmpz_poly_cos_minpoly');
  special('legendrep', 'fmpq_poly_legendre_p', () => Poly(QQ, 'x'));
  for (const [n, d] of [['cyclotomic', 'Φ_n(x): polinômio ciclotômico'], ['chebyshevt', 'T_n(x)'], ['chebyshevu', 'U_n(x)'], ['hermiteh', 'H_n(x) de Hermite'], ['swinnertondyer', 'polinômio de Swinnerton-Dyer'], ['cosminpoly', 'polinômio mínimo de cos(2π/n)'], ['legendrep', 'P_n(x) de Legendre']]) {
    DOCS.set(n, `${n}(n, var="x"): ${d}`);
  }
  def('poly', null, ([cs, R]) => {
    const items = iterable(cs);
    let P = R;
    if (!(P instanceof PolyRing)) {
      let base = R instanceof Ring ? R : ZZ;
      if (!(R instanceof Ring)) for (const c of items) base = commonRing(base, elem(c).ring);
      P = Poly(base, 'x');
    }
    return P.fromCoeffs(items);
  }, 'poly([c0, c1, ...], R): polinômio a partir de coeficientes');
  def('evalpoly', 2, ([p, x]) => evalPoly(poly(p), x), 'evalpoly(p, x) = p(x)');

  // --------------------------------------------------------- matrizes
  const mat = (m, what = 'argumento') => {
    if (!(m instanceof Elem) || !(m.ring instanceof MatSpace)) fail(`${what} deve ser uma matriz`);
    return m;
  };
  const square = (m) => {
    if (!m.ring.isSquare(m)) fail('a matriz deve ser quadrada');
    return m;
  };
  def('matrix', null, (args) => {
    if (args.length === 1) {
      const rows = iterable(args[0]).map((r) => iterable(r));
      return matrixFromRows(rows);
    }
    const [m, n, f] = args;
    const r = toInt(m), c = toInt(n);
    const rows = [];
    for (let i = 1; i <= r; i++) {
      const row = [];
      for (let j = 1; j <= c; j++) row.push(f instanceof Func ? callValue(f, [int(i), int(j)]) : f);
      rows.push(row);
    }
    return matrixFromRows(rows);
  }, 'matrix([[...], ...]) ou matrix(m, n, (i, j) -> ...)');
  def('identity', null, ([n, R]) => Mat(R instanceof Ring ? R : ZZ).identity(toInt(n)), 'identity(n, R=ZZ): matriz identidade');
  def('zeros', null, ([m, n, R]) => Mat(R instanceof Ring ? R : ZZ).alloc(toInt(m), toInt(n ?? m)), 'zeros(m, n, R=ZZ): matriz nula');
  def('diagonal', 1, ([xs]) => {
    const items = iterable(xs);
    return matrixFromRows(items.map((x, i) => items.map((_, j) => (i === j ? x : int(0)))));
  }, 'diagonal([a, b, ...]): matriz diagonal');
  def('nrows', 1, ([m]) => int(mat(m).ring.nrows(m)), 'nrows(A)');
  def('ncols', 1, ([m]) => int(mat(m).ring.ncols(m)), 'ncols(A)');
  def('rows', 1, ([m]) => mat(m).ring.rows(m), 'rows(A): lista de linhas');
  def('cols', 1, ([m]) => {
    const rows = mat(m).ring.rows(m);
    return rows.length ? rows[0].map((_, j) => rows.map((r) => r[j])) : [];
  }, 'cols(A): lista de colunas');
  def('transpose', 1, ([m]) => {
    const R = mat(m).ring;
    if (R.has('transpose')) return R.op(`${R.tag}_transpose`, m);
    const rows = R.rows(m);
    return R.fromRows(rows.length ? rows[0].map((_, j) => rows.map((r) => r[j])) : []);
  }, 'transpose(A)');
  def('det', 1, ([m]) => {
    const R = square(mat(m)).ring;
    if (R.has('det')) return R.op(`${R.tag}_det`, m);
    return charpolyOf(m, R).ring.coeff(charpolyOf(m, R), 0);
  }, 'det(A): determinante');
  def('trace', 1, ([m]) => {
    const R = square(mat(m)).ring;
    if (R.has('trace')) return R.op(`${R.tag}_trace`, m);
    let t = R.base.zero();
    for (let i = 0; i < R.nrows(m); i++) t = add(t, R.entry(m, i, i));
    return t;
  }, 'trace(A): traço');
  def('rank', 1, ([m]) => {
    const R = mat(m).ring;
    if (R.has('rank')) return int(R.op(`${R.tag}_rank`, m));
    fail(`rank não suportado em ${R}`);
  }, 'rank(A): posto');
  const charpolyOf = (m, R, v = 'x') => {
    if (!R.has('charpoly')) fail(`charpoly não suportado em ${R}`);
    return R.opTo(Poly(R.base, v), `${R.tag}_charpoly`, m);
  };
  def('charpoly', null, ([m, v]) => {
    const R = square(mat(m)).ring;
    let p = charpolyOf(m, R);
    if (v instanceof Elem && v.ring instanceof PolyRing) p = coerce(p, Poly(R.base, v.ring.v));
    else if (typeof v === 'string') p = coerce(p, Poly(R.base, v));
    return p;
  }, 'charpoly(A, var="x"): polinômio característico det(x·I − A)');
  def('minpoly', 1, ([m]) => {
    const R = square(mat(m)).ring;
    if (!R.has('minpoly')) fail(`minpoly não suportado em ${R}`);
    return R.opTo(Poly(R.base, 'x'), `${R.tag}_minpoly`, m);
  }, 'minpoly(A): polinômio mínimo');
  def('inverse', 1, ([m]) => matInv(mat(m)), 'inverse(A): inversa');
  def('solve', 2, ([A, b]) => {
    mat(A);
    let B = b;
    const wasList = Array.isArray(b);
    if (wasList) B = matrixFromRows(b.map((x) => [x]));
    mat(B);
    let R = commonRing(A.ring, B.ring);
    if (R.base === ZZ) R = Mat(QQ);
    const a = coerce(A, R), bb = coerce(B, R);
    let X;
    if (R.tag === 'fmpq_mat') X = R.wrap(flint().raw('fmpq_mat_solve', a.ptr, bb.ptr));
    else if (R.has('solve')) X = R.op(`${R.tag}_solve`, a, bb);
    else X = R.mul(matInv(a), bb);
    return wasList ? R.rows(X).map((r) => r[0]) : X;
  }, 'solve(A, b): solução de A·x = b (b vetor ou matriz)');
  def('rref', 1, ([m]) => {
    let R = mat(m).ring;
    if (R.base === ZZ) { R = Mat(QQ); m = coerce(m, R); }
    if (R.tag === 'fmpq_mat') return R.wrap(flint().raw('fmpq_mat_rref', m.ptr));
    if (R.has('rref')) return R.op(`${R.tag}_rref`, m);
    fail(`rref não suportado em ${R}`);
  }, 'rref(A): forma escalonada reduzida');
  def('nullspace', 1, ([m]) => {
    let R = mat(m).ring;
    if (R.base === ZZ || R.base === QQ) {
      const N = Mat(QQ).wrap(flint().raw('fmpq_mat_nullspace', coerce(m, Mat(QQ)).ptr));
      // Vetores primitivos, com primeira entrada não nula positiva.
      return env.lookup('cols').impl([N]).map((v) => {
        const g = v.reduce((a, x) => ZZ.op('fmpz_gcd', a, QQ.num(x)), int(0));
        const first = v.find((x) => !isZero(x));
        const s = first && sign(first) < 0 ? ZZ.neg(g) : g;
        return isZero(g) ? v : v.map((x) => QQ.num(QQ.coerce(div(x, s))));
      });
    }
    fail(`nullspace não suportado em ${R}`);
  }, 'nullspace(A): base do núcleo (lista de vetores)');
  alias('kernel', 'nullspace');
  def('hnf', 1, ([m]) => mat(m).ring === Mat(ZZ) ? Mat(ZZ).op('fmpz_mat_hnf', m) : fail('hnf requer matriz inteira'), 'hnf(A): forma normal de Hermite');
  def('snf', 1, ([m]) => mat(m).ring === Mat(ZZ) ? Mat(ZZ).op('fmpz_mat_snf', m) : fail('snf requer matriz inteira'), 'snf(A): forma normal de Smith');
  def('lll', 1, ([m]) => mat(m).ring === Mat(ZZ) ? Mat(ZZ).op('fmpz_mat_lll', m) : fail('lll requer matriz inteira'), 'lll(A): redução LLL das linhas');
  def('eigenvalues', 1, ([m]) => {
    const F = flint();
    const A = coerce(square(mat(m)), Mat(CC));
    return F.vec(F.raw('acb_mat_eig', A.ptr, F.prec)).map((p) => CC.wrap(p));
  }, 'eigenvalues(A): autovalores (bolas complexas)');
  alias('eig', 'eigenvalues');
  def('expm', 1, ([m]) => {
    let R = square(mat(m)).ring;
    if (R.base !== CC) { R = Mat(RR); m = coerce(m, R); }
    return R.op(`${R.tag}_exp`, m);
  }, 'expm(A): exponencial de matriz');
  def('dot', 2, ([a, b]) => {
    const x = iterable(a), y = iterable(b);
    if (x.length !== y.length) fail('vetores de tamanhos diferentes');
    return x.reduce((s, xi, i) => add(s, mul(xi, y[i])), int(0));
  }, 'dot(u, v): produto escalar');
  def('vector', 1, ([xs]) => matrixFromRows(iterable(xs).map((x) => [x])), 'vector([...]): matriz coluna');

  // --------------------------------------------------------- corpos finitos
  def('frobenius', null, ([a, e]) => a.ring.op('fq_frobenius', a, e === undefined ? 1 : toInt(e)), 'frobenius(a, e=1) = a^(p^e)');
  def('fqtrace', 1, ([a]) => a.ring.opTo(ZZ, 'fq_trace', a), 'fqtrace(a): traço absoluto');
  def('norm', 1, ([a]) => {
    if (a instanceof Elem && a.ring instanceof FiniteField) return a.ring.opTo(ZZ, 'fq_norm', a);
    if (Array.isArray(a)) return env.lookup('sqrt').impl([env.lookup('dot').impl([a, a])]);
    return mul(a, env.lookup('conj').impl([a]));
  }, 'norm(a): norma (corpo finito), norma euclidiana (vetor)');
  def('isgenerator', 1, ([a]) => {
    const R = a.ring;
    if (!(R instanceof FiniteField)) fail('isgenerator espera elemento de GF(q)');
    return equal(R.op('fq_order', a), sub(pow(R.p, int(R.k)), int(1)));
  }, 'isgenerator(a): a gera o grupo multiplicativo?');
  def('elements', 1, ([R]) => {
    if (R instanceof ZmodRing) {
      const n = ZZ.toSmall(R.n);
      if (n === null || n > 1e6) fail('anel grande demais');
      return Array.from({ length: n }, (_, i) => R.fromInt(i));
    }
    if (R instanceof FiniteField) {
      const q = ZZ.toSmall(pow(R.p, int(R.k)));
      if (q === null || q > 1e6) fail('corpo grande demais');
      const p = ZZ.toSmall(R.p);
      const out = [];
      const P = Poly(ZZ, 'x');
      for (let i = 0; i < q; i++) {
        const cs = [];
        for (let t = i, j = 0; j < R.k; j++, t = Math.floor(t / p)) cs.push(int(t % p));
        out.push(R.opTo(R, 'fq_from_poly', P.fromCoeffs(cs)));
      }
      return out;
    }
    fail('elements espera Z/nZ ou GF(q)');
  }, 'elements(F): lista de todos os elementos');

  // --------------------------------------------------------- listas
  const list = (xs, what) => iterable(xs, null, what);
  const fn = (f) => {
    if (!(f instanceof Func) && !(f instanceof Elem && f.ring instanceof PolyRing)) fail('esperava uma função');
    return f;
  };
  def('len', 1, ([xs]) => int(xs instanceof Elem && xs.ring instanceof PolyRing ? xs.ring.len(xs) : list(xs).length), 'len(xs): tamanho');
  alias('length', 'len');
  def('map', 2, ([xs, f]) => list(xs).map((x) => callValue(fn(f), [x])), 'map(xs, f): [f(x) | x <- xs]');
  def('filter', 2, ([xs, f]) => list(xs).filter((x) => toBool(callValue(fn(f), [x]), 'predicado')), 'filter(xs, p): elementos que satisfazem p');
  def('reduce', null, ([xs, f, init]) => {
    const items = list(xs);
    if (init === undefined) {
      if (!items.length) fail('reduce de lista vazia sem valor inicial');
      return items.slice(1).reduce((a, x) => callValue(fn(f), [a, x]), items[0]);
    }
    return items.reduce((a, x) => callValue(fn(f), [a, x]), init);
  }, 'reduce(xs, f, init): dobra à esquerda');
  alias('fold', 'reduce');
  def('scan', null, ([xs, f, init]) => {
    const items = list(xs);
    const out = [];
    let a = init;
    for (const x of items) {
      a = a === undefined ? x : callValue(fn(f), [a, x]);
      out.push(a);
    }
    return out;
  }, 'scan(xs, f, init): somas parciais generalizadas');
  def('sum', null, ([xs, f]) => {
    let items = list(xs);
    if (f) items = items.map((x) => callValue(fn(f), [x]));
    return items.reduce((a, x) => binop('+', a, x), int(0));
  }, 'sum(xs) ou sum(xs, f): soma');
  alias('Σ', 'sum');
  def('prod', null, ([xs, f]) => {
    let items = list(xs);
    if (f) items = items.map((x) => callValue(fn(f), [x]));
    return items.reduce((a, x) => binop('*', a, x), int(1));
  }, 'prod(xs) ou prod(xs, f): produto');
  alias('Π', 'prod');
  def('range', null, ([a, b, s]) => (b === undefined ? range(int(1), a, int(1)) : range(a, b, s ?? int(1))), 'range(n) = 1..n; range(a, b, passo)');
  def('first', 1, ([xs]) => list(xs)[0] ?? fail('lista vazia'), 'first(xs)');
  def('last', 1, ([xs]) => { const l = list(xs); return l.length ? l[l.length - 1] : fail('lista vazia'); }, 'last(xs)');
  def('head', 1, ([xs]) => list(xs)[0] ?? fail('lista vazia'), 'head(xs)');
  def('tail', 1, ([xs]) => list(xs).slice(1), 'tail(xs): todos menos o primeiro');
  def('take', 2, ([xs, n]) => list(xs).slice(0, Math.max(0, toInt(n))), 'take(xs, n)');
  def('drop', 2, ([xs, n]) => list(xs).slice(Math.max(0, toInt(n))), 'drop(xs, n)');
  def('reverse', 1, ([xs]) => (typeof xs === 'string' ? [...xs].reverse().join('') : [...list(xs)].reverse()), 'reverse(xs)');
  const cmpValues = (a, b) => {
    if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
    if (Array.isArray(a) && Array.isArray(b)) {
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        const c = cmpValues(a[i], b[i]);
        if (c) return c;
      }
      return a.length - b.length;
    }
    if (a instanceof Tuple && b instanceof Tuple) return cmpValues(a.items, b.items);
    if (a instanceof Elem && b instanceof Elem && a.ring === b.ring && a.ring instanceof ZmodRing) {
      return ZZ.cmp(a.ring.lift(a), b.ring.lift(b));
    }
    return compare(a, b, '<') ? -1 : compare(b, a, '<') ? 1 : 0;
  };
  def('sort', null, ([xs, key]) => {
    const items = [...list(xs)];
    if (key) {
      const keyed = items.map((x) => [callValue(fn(key), [x]), x]);
      keyed.sort((a, b) => cmpValues(a[0], b[0]));
      return keyed.map((k) => k[1]);
    }
    return items.sort(cmpValues);
  }, 'sort(xs, key=): ordena');
  def('min', null, (args) => {
    const xs = args.length === 1 ? list(args[0]) : args;
    if (!xs.length) fail('min de lista vazia');
    return xs.reduce((a, b) => (cmpValues(b, a) < 0 ? b : a));
  }, 'min(xs) ou min(a, b, ...)');
  def('max', null, (args) => {
    const xs = args.length === 1 ? list(args[0]) : args;
    if (!xs.length) fail('max de lista vazia');
    return xs.reduce((a, b) => (cmpValues(b, a) > 0 ? b : a));
  }, 'max(xs) ou max(a, b, ...)');
  def('zip', null, (args) => {
    const ls = args.map((a) => list(a));
    const n = Math.min(...ls.map((l) => l.length));
    return Array.from({ length: n }, (_, i) => new Tuple(ls.map((l) => l[i])));
  }, 'zip(xs, ys, ...): lista de tuplas');
  def('enumerate', 1, ([xs]) => list(xs).map((x, i) => new Tuple([int(i + 1), x])), 'enumerate(xs): [(1, x1), (2, x2), ...]');
  def('concat', null, (args) => (args.length === 1 ? list(args[0]).flatMap((l) => list(l)) : args.flatMap((l) => list(l))), 'concat(xs, ys, ...) ou concat(lista de listas)');
  def('flatten', 1, ([xs]) => {
    const go = (v) => (Array.isArray(v) ? v.flatMap(go) : [v]);
    return go(list(xs));
  }, 'flatten(xs): achata recursivamente');
  def('unique', 1, ([xs]) => {
    const out = [];
    for (const x of list(xs)) if (!out.some((y) => valuesEqual(x, y))) out.push(x);
    return out;
  }, 'unique(xs): remove repetidos');
  def('count', 2, ([xs, f]) => int(list(xs).filter((x) => (f instanceof Func ? toBool(callValue(f, [x])) : valuesEqual(x, f))).length), 'count(xs, p): quantos satisfazem p (ou são iguais a p)');
  def('all', null, ([xs, f]) => list(xs).every((x) => toBool(f ? callValue(fn(f), [x]) : x)), 'all(xs, p)');
  def('any', null, ([xs, f]) => list(xs).some((x) => toBool(f ? callValue(fn(f), [x]) : x)), 'any(xs, p)');
  def('find', 2, ([xs, f]) => {
    const r = list(xs).find((x) => toBool(callValue(fn(f), [x])));
    return r === undefined ? UNIT : r;
  }, 'find(xs, p): primeiro elemento que satisfaz p, ou ()');
  def('indexof', 2, ([xs, v]) => int(list(xs).findIndex((x) => valuesEqual(x, v)) + 1), 'indexof(xs, v): posição (1-based) ou 0');
  def('iterate', 3, ([f, x, n]) => {
    const out = [x];
    let v = x;
    for (let i = 0; i < toInt(n); i++) out.push((v = callValue(fn(f), [v])));
    return out;
  }, 'iterate(f, x, n): [x, f(x), f(f(x)), ...] com n aplicações');
  def('nest', 3, ([f, x, n]) => {
    let v = x;
    for (let i = 0; i < toInt(n); i++) v = callValue(fn(f), [v]);
    return v;
  }, 'nest(f, x, n) = f(f(...f(x)))');
  def('fixedpoint', null, ([f, x, max]) => {
    let v = x;
    const lim = max === undefined ? 10000 : toInt(max);
    for (let i = 0; i < lim; i++) {
      const w = callValue(fn(f), [v]);
      if (valuesEqual(w, v)) return w;
      v = w;
    }
    fail('fixedpoint não convergiu');
  }, 'fixedpoint(f, x): itera f até estabilizar');
  def('while', 3, ([cond, f, x]) => {
    let v = x;
    let guard = 0;
    while (toBool(callValue(fn(cond), [v]))) {
      v = callValue(fn(f), [v]);
      if (++guard > 1e8) fail('laço longo demais');
    }
    return v;
  }, 'while(cond, f, x): aplica f enquanto cond(x)');
  def('table', null, (args) => {
    const f = args[0];
    const ranges = args.slice(1).map((r) => list(r));
    const go = (k, acc) => (k === ranges.length ? callValue(fn(f), acc) : ranges[k].map((v) => go(k + 1, [...acc, v])));
    return go(0, []);
  }, 'table(f, xs, ys, ...): tabela f(x, y, ...)');
  def('tuple', null, (args) => new Tuple(args), 'tuple(a, b, ...)');
  def('list', 1, ([x]) => [...iterable(x)], 'list(x): converte tupla/string em lista');
  def('apply', 2, ([f, xs]) => callValue(fn(f), list(xs)), 'apply(f, xs) = f(xs...)');
  def('id', 1, ([x]) => x, 'id(x) = x');

  // --------------------------------------------------------- acesso direto à FLINT
  // flint("arb_gamma", x): chama um binding de bindings.def, convertendo os
  // argumentos para os tipos C declarados. Contextos (Z/nZ, GF(q)) vêm de um
  // argumento-anel explícito ou dos elementos passados.
  const tagRing = (tag, base, v) => {
    switch (tag) {
      case 'fmpz': return ZZ;
      case 'fmpq': return QQ;
      case 'arb': return RR;
      case 'acb': return CC;
      case 'zmod': case 'fq':
        if (!base) fail(`${tag} requer um anel Zmod(n)/GF(q) como argumento`);
        return base;
    }
    const m = /^(fmpz|fmpq|arb|acb|zmod|fq)_(poly|mat)$/.exec(tag);
    if (!m) fail(`tipo FLINT desconhecido: ${tag}`);
    const b = tagRing(m[1], base, v);
    return m[2] === 'poly' ? Poly(b, v) : Mat(b);
  };
  def('flint', null, (args) => {
    const [name, ...rest] = args;
    if (typeof name !== 'string') fail('flint(nome, args...) espera o nome da função como string');
    const sig = flint().signatures()[name];
    if (!sig) fail(`função FLINT desconhecida: ${name}`);
    const ret = sig[0].split('@')[0];
    const types = sig[1];
    let base = null;
    let v = 'x';
    for (const a of rest) {
      if (a instanceof ZmodRing || a instanceof FiniteField) base ??= a;
      if (a instanceof Elem) {
        const B = a.ring.base ?? a.ring;
        if (B instanceof ZmodRing || B instanceof FiniteField) base ??= B;
        if (a.ring instanceof PolyRing) v = a.ring.v;
      }
    }
    const call = [];
    let k = 0;
    for (const t of types) {
      if (t === 'prec') continue;
      if (t === 'modctx' || t === 'fqctx') {
        if (rest[k] instanceof Ring) k++;
        if (!base) fail(`${name} requer um anel Zmod(n)/GF(q) como argumento`);
        continue;
      }
      if (k >= rest.length) fail(`${name} espera mais argumentos: (${types.filter((x) => x !== 'prec').join(', ')})`);
      const a = rest[k++];
      if (t === 'si' || t === 'ui') call.push(toInt(a));
      else if (t === 'd') call.push(toNum(a));
      else if (t === 'str') call.push(String(a));
      else call.push(coerce(elem(a), tagRing(t, base, v)));
    }
    if (k !== rest.length) fail(`${name} espera ${k} argumento${k === 1 ? '' : 's'}, recebeu ${rest.length}`);
    const caller = base ?? ZZ;
    const out = ['int', 'si', 'ui', 'd'].includes(ret) ? undefined : tagRing(ret, base, v);
    const r = caller.call(name, call, out);
    if (typeof r === 'number') return ret === 'd' ? RR.fromNumber(r) : int(r);
    return r;
  }, 'flint(nome, args...): chama diretamente uma função FLINT exposta (ver aba FLINT da referência)');

  // --------------------------------------------------------- strings e tipos
  def('str', 1, ([x]) => (typeof x === 'string' ? x : showText(x)), 'str(x): representação textual');
  def('type', 1, ([x]) => typeName(x), 'type(x): nome do tipo');
  def('error', 1, ([m]) => fail(String(typeof m === 'string' ? m : showText(m))), 'error(msg): interrompe com erro');
  def('assert', null, ([c, m]) => (toBool(c) ? true : fail(m ? String(m) : 'asserção falhou')), 'assert(cond, msg)');
  def('time', 1, ([f]) => {
    const t0 = performance.now();
    const v = callValue(fn(f), []);
    return new Tuple([v, RR.fromNumber((performance.now() - t0) / 1000)]);
  }, 'time(() -> expr): (valor, segundos)');

  // --------------------------------------------------------- gráficos
  const toNum = (v) => {
    if (v instanceof Elem) {
      if (v.ring === ZZ) return ZZ.toNumber(v);
      if (v.ring === QQ) return QQ.toNumber(v);
      if (v.ring === RR) return RR.mid(v);
      if (v.ring === CC) {
        const im = CC.im(v);
        if (RR.mid(im) !== 0 && Math.abs(RR.mid(im)) > 1e-12 * Math.abs(RR.mid(CC.re(v)))) return NaN;
        return RR.mid(CC.re(v));
      }
    }
    if (typeof v === 'number') return v;
    return NaN;
  };
  const sample = (f, a, b, n) => {
    const pts = [];
    const lo = toNum(a), hi = toNum(b);
    if (!(hi > lo)) fail('intervalo do gráfico inválido');
    const F = flint();
    F.withPrec(64, () => {
      for (let i = 0; i <= n; i++) {
        const x = lo + ((hi - lo) * i) / n;
        let y;
        try {
          y = toNum(callValue(f, [RR.fromNumber(x)]));
        } catch (e) {
          if (e.name === 'CauchyError' && /recursão/.test(e.message)) throw e;
          y = NaN;
        }
        pts.push([x, Number.isFinite(y) ? y : null]);
      }
    });
    return pts;
  };
  def('plot', null, ([fs, a, b], kw) => {
    const funcs = Array.isArray(fs) ? fs : [fs];
    const n = kw.points ? toInt(kw.points) : 400;
    const series = funcs.map((f, i) => ({ points: sample(fn(f), a, b, n), label: f.name ?? `f${funcs.length > 1 ? i + 1 : ''}` }));
    return new Plot({ kind: 'line', series, title: kw.title ?? null, ylim: kw.ylim ? iterable(kw.ylim).map(toNum) : null });
  }, 'plot(f, a, b) ou plot([f, g], a, b, points=400, ylim=[lo, hi])');
  def('listplot', null, ([xs], kw) => {
    const items = list(xs);
    const points = items.map((p, i) => {
      if (p instanceof Tuple) return [toNum(p.items[0]), toNum(p.items[1])];
      return [i + 1, toNum(p)];
    });
    return new Plot({ kind: kw.joined === true ? 'line' : 'scatter', series: [{ points, label: '' }], title: kw.title ?? null });
  }, 'listplot(ys) ou listplot([(x, y), ...], joined=false)');
  def('complexplot', null, ([zs], kw) => {
    const points = list(zs).map((z) => {
      const c = CC.coerce(elem(z));
      return [RR.mid(CC.re(c)), RR.mid(CC.im(c))];
    });
    return new Plot({ kind: 'scatter', series: [{ points, label: '' }], equal: true, title: kw.title ?? null });
  }, 'complexplot(zs): pontos no plano complexo');

  // --------------------------------------------------------- widgets
  const widget = (kind, spec, defVal, parse) => {
    const c = currentContext();
    const i = c.widgetIndex++;
    const raw = c.widgets[i] !== undefined && c.widgets[i].kind === kind ? c.widgets[i].value : defVal;
    c.widgets[i] = { kind, value: raw };
    return new Widget(kind, { ...spec, index: i }, parse(raw), raw);
  };
  def('slider', null, ([a, b, step], kw) => {
    const lo = toNum(a), hi = toNum(b);
    const st = step !== undefined ? toNum(step) : kw.step !== undefined ? toNum(kw.step) : 1;
    const isInt = [a, b].every((x) => x instanceof Elem && x.ring === ZZ) && Number.isInteger(st);
    const init = kw.value !== undefined ? toNum(kw.value) : lo;
    return widget('slider', { min: lo, max: hi, step: st, label: kw.label ?? null }, init,
      (v) => (isInt ? int(Math.round(v)) : QQ.fromDecimal(String(v))));
  }, 'slider(a, b, passo=1, value=): controle deslizante');
  def('checkbox', null, (args, kw) => widget('checkbox', { label: kw.label ?? null }, kw.value === true, (v) => !!v), 'checkbox(value=false)');
  def('textinput', null, (args, kw) => widget('text', { label: kw.label ?? null }, kw.value ?? '', (v) => String(v)), 'textinput(value=""): campo de texto');
  def('numinput', null, (args, kw) => widget('number', { label: kw.label ?? null }, kw.value !== undefined ? showText(kw.value) : '0',
    (v) => {
      const s = String(v).trim();
      if (/^-?\d+$/.test(s)) return ZZ.fromString(s);
      if (/^-?\d+\/\d+$/.test(s)) { const [n, d] = s.split('/'); return QQ.frac(ZZ.fromString(n), ZZ.fromString(d)); }
      return RR.fromString(s);
    }), 'numinput(value=0): campo numérico (inteiro, racional ou real)');
  def('select', null, ([opts], kw) => {
    const items = list(opts);
    return widget('select', { options: items.map((x) => (typeof x === 'string' ? x : showText(x))), label: kw.label ?? null }, 0,
      (v) => items[Math.max(0, Math.min(items.length - 1, v | 0))]);
  }, 'select([op1, op2, ...]): lista de opções');

  // Constantes dinâmicas (dependem da precisão corrente).
  env.dynamic = new Map([
    ['pi', () => RR.op('arb_const_pi')],
    ['π', () => RR.op('arb_const_pi')],
    ['e', () => RR.op('arb_const_e')],
    ['i', () => CC.op('acb_const_i')],
    ['γ', () => RR.op('arb_const_euler')],
    ['euler', () => RR.op('arb_const_euler')],
    ['catalan', () => RR.op('arb_const_catalan')],
    ['khinchin', () => RR.op('arb_const_khinchin')],
    ['glaisher', () => RR.op('arb_const_glaisher')],
    ['inf', () => RR.op('arb_div', RR.one(), RR.zero())],
  ]);
  for (const [k, d] of [['pi', 'π (precisão corrente)'], ['e', 'número de Euler e'], ['i', 'unidade imaginária'],
    ['euler', 'constante de Euler–Mascheroni γ'], ['catalan', 'constante de Catalan G'], ['khinchin', 'constante de Khinchin'],
    ['glaisher', 'constante de Glaisher–Kinkelin']]) DOCS.set(k, d);

  return env;
}

// ------------------------------------------------- anel como função, p(x)

function ringCall(R, args, kw) {
  if (args.length === 0) fail(`${R}() espera um argumento`);
  const [x, y] = args;
  if (R === CC && args.length === 2) return CC.fromParts(RR.coerce(x), RR.coerce(y));
  if (R === QQ && args.length === 2) return div(coerce(x, ZZ), coerce(y, ZZ));
  if (typeof x === 'string') {
    if (R === ZZ) return ZZ.fromString(x.trim());
    if (R === QQ) {
      const [n, d] = x.split('/');
      return QQ.frac(ZZ.fromString(n.trim()), ZZ.fromString((d ?? '1').trim()));
    }
    if (R === RR) return RR.fromString(x.trim());
    fail(`não é possível converter string em ${R}`);
  }
  if (Array.isArray(x)) {
    if (R instanceof PolyRing) return R.fromCoeffs(x);
    if (R instanceof MatSpace) return R.fromRows(x.map((r) => iterable(r)));
    if (R instanceof FiniteField) return R.opTo(R, 'fq_from_poly', Poly(ZZ, 'x').fromCoeffs(x));
    return x.map((v) => ringCall(R, [v], kw));
  }
  if (!(x instanceof Elem)) fail(`não é possível converter ${typeName(x)} em ${R}`);
  if (R === ZZ) {
    if (x.ring === QQ) {
      if (ZZ.toStr(QQ.den(x)) !== '1') fail('racional não inteiro');
      return QQ.num(x);
    }
    if (x.ring === RR) return ZZ.wrap(flint().raw('arb_get_unique_fmpz', x.ptr));
    if (x.ring instanceof ZmodRing) return x.ring.lift(x);
  }
  if (R === RR && x.ring === CC) {
    if (!CC.op('acb_is_real', x)) fail('número complexo com parte imaginária não nula');
    return CC.re(x);
  }
  if (R instanceof ZmodRing && x.ring instanceof ZmodRing) return R.coerce(x.ring.lift(x));
  if (isScalarRing(R) && x.ring instanceof MatSpace) return coerce(x, Mat(R));
  if (isScalarRing(R) && !(R instanceof FiniteField) && x.ring instanceof PolyRing) return coerce(x, Poly(R, x.ring.v));
  if (R instanceof FiniteField && x.ring instanceof PolyRing) {
    const P = Poly(ZZ, x.ring.v);
    const z = x.ring.base === ZZ ? x : coerce(x, P);
    return R.opTo(R, 'fq_from_poly', z);
  }
  if (R instanceof MatSpace && x.ring instanceof MatSpace && x.ring.base instanceof ZmodRing && R.base === ZZ) {
    return Mat(ZZ).fromRows(x.ring.rows(x).map((r) => r.map((e) => x.ring.base.lift(e))));
  }
  return coerce(x, R);
}

function evalPoly(p, x) {
  if (Array.isArray(x)) return x.map((v) => evalPoly(p, v));
  if (!(x instanceof Elem)) fail('polinômio avaliado em valor não numérico');
  const R = p.ring;
  if (x.ring instanceof PolyRing) {
    const S = commonRing(R, x.ring);
    return S.op(`${S.tag}_compose`, coerce(p, S), coerce(x, S));
  }
  if (x.ring instanceof MatSpace) {
    // Horner com matrizes
    const M = x.ring;
    const cs = R.coeffs(p);
    const n = M.nrows(x);
    let acc = mul(M.identity(n), R.base.zero());
    for (let i = cs.length - 1; i >= 0; i--) acc = add(mul(acc, x), mul(M.identity(n), cs[i]));
    return acc;
  }
  const B = commonRing(R.base, x.ring);
  const P = Poly(B, R.v);
  const pc = coerce(p, P);
  const xc = coerce(x, B);
  switch (P.tag) {
    case 'fmpz_poly': return P.opTo(ZZ, 'fmpz_poly_evaluate_fmpz', pc, xc);
    case 'fmpq_poly': return P.opTo(QQ, 'fmpq_poly_evaluate_fmpq', pc, xc);
    case 'arb_poly': return P.opTo(RR, 'arb_poly_evaluate', pc, xc);
    case 'acb_poly': return P.opTo(CC, 'acb_poly_evaluate', pc, xc);
    case 'zmod_poly': return P.opTo(B, 'zmod_poly_evaluate', pc, xc);
    case 'fq_poly': return P.opTo(B, 'fq_poly_evaluate', pc, xc);
  }
  fail(`avaliação não suportada em ${P}`);
}

setRingCall(ringCall);
setEvalPoly(evalPoly);
setToStr((v) => showText(v));
