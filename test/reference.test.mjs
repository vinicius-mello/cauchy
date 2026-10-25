import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { init, evalOne, Notebook } from './harness.mjs';
import { REF, ALIASES, CATEGORIES } from '../src/ui/reference.js';
import { DOCS } from '../src/js/lang/builtins.js';
import { setLang, translateError } from '../src/ui/i18n.js';
import { SIG } from '../src/js/runtime/bindings.gen.js';

before(async () => {
  await init();
  new Notebook(); // popula DOCS
});

test('toda função embutida tem entrada na referência', () => {
  const missing = [...DOCS.keys()].filter((n) => !REF.has(n) && !ALIASES[n]);
  assert.deepEqual(missing, []);
  const cats = new Set(CATEGORIES.map((c) => c[0]));
  for (const e of REF.values()) {
    assert.ok(cats.has(e.cat), `${e.name}: categoria ${e.cat}`);
    assert.ok(e.pt && e.en, `${e.name}: descrição`);
  }
  for (const [a, n] of Object.entries(ALIASES)) assert.ok(REF.has(n), `alias ${a} -> ${n}`);
});

test('funções FLINT citadas existem na FLINT exposta ou são conhecidas', () => {
  const cfuncs = new Set(Object.values(SIG).map((s) => s[2]));
  const extra = new Set([
    'fmpz_set_str', 'arb_get_unique_fmpz', 'fmpq_canonicalise', 'arb_set_str', 'acb_set_arb_arb', 'fmpz_mod_ctx_init',
    'fq_default_ctx_init', 'fmpz_poly_set_coeff_fmpz', 'fq_default_get_fmpz_poly', 'fmpz_mod_poly_get_fmpz_poly',
    'arb_lt', 'fmpz_fdiv_qr', 'fmpq_poly_divrem', 'fmpz_mod_poly_divrem', 'fq_default_poly_divrem', 'arb_poly_divrem',
    'fmpq_mat_inv', 'fmpz_factor', 'fmpz_poly_factor', 'fmpz_mod_poly_factor', 'fq_default_poly_factor', 'fmpz_xgcd',
    'fmpz_get_str', 'fmpz_randm', 'partitions_fmpz_fmpz', 'fmpz_sqrtmod', 'arb_hypgeom_li', 'arb_hypgeom_airy',
    'acb_hypgeom_airy', 'arb_lambertw', 'acb_lambertw', 'arb_hypgeom_gamma_upper', 'acb_hypgeom_gamma_upper',
    'acb_hypgeom_2f1', 'acb_dirichlet_zeta_zero', 'acb_onei', 'arb_get_mid_arb', 'arb_get_rad_arb',
    'fmpz_poly_length', 'fmpz_poly_get_coeff_fmpz', 'arb_fmpz_poly_complex_roots', 'acb_poly_find_roots',
    'fmpz_mod_poly_roots', 'fq_default_poly_roots', 'fmpz_mat_init', 'fmpq_mat_init', 'fmpq_mat_rref', 'fmpq_mat_solve',
    'fmpz_mat_nullspace', 'fmpz_lll', 'acb_mat_approx_eig_qr', 'acb_mat_eig_simple', 'acb_mat_eig_multiple',
    'arb_mat_inv', 'acb_mat_inv', 'fmpz_mod_mat_inv', 'fq_default_mat_inv', 'fmpz_mod_mat_rref', 'fq_default_mat_rref',
    'fq_default_ctx_order', 'fq_default_pow', 'fq_default_ctx_modulus', 'fq_default_set_fmpz_poly', 'fmpz_mod_inv',
    'fmpz_mod_set_fmpz', 'fq_default_gen', 'fmpq_mat_set_fmpz_mat', 'fmpz_mod_mat_set_fmpz_mat', 'arb_set_fmpq',
    'arb_union', 'fmpz_mod_mat_det', 'fmpz_mod_mat_rank', 'fmpz_mod_mat_charpoly', 'fq_default_mat_rank',
    'fq_default_mat_charpoly', 'fq_default_mat_minpoly', 'fmpz_mod_poly_derivative', 'fq_default_poly_derivative',
    'fmpz_mod_poly_compose', 'fq_default_poly_compose', 'fmpz_mod_poly_gcd', 'fq_default_poly_gcd',
    'fmpz_mod_poly_make_monic', 'fq_default_poly_make_monic', 'fmpz_mod_poly_is_irreducible',
    'fq_default_poly_is_irreducible', 'fq_default_frobenius', 'fq_default_trace', 'fq_default_norm', 'fq_default_inv',
    'fq_default_sqrt', 'arb_hypgeom_erf', 'acb_hypgeom_erf', 'arb_hypgeom_erfc', 'acb_hypgeom_erfc', 'arb_hypgeom_erfi',
    'arb_hypgeom_ei', 'acb_hypgeom_ei', 'arb_hypgeom_si', 'arb_hypgeom_ci', 'arb_hypgeom_bessel_j', 'acb_hypgeom_bessel_j',
    'arb_hypgeom_bessel_y', 'acb_hypgeom_bessel_y', 'arb_hypgeom_bessel_i', 'acb_hypgeom_bessel_i',
    'arb_hypgeom_bessel_k', 'acb_hypgeom_bessel_k', 'acb_get_real', 'acb_get_imag', 'arith_bell_number',
    'arith_stirling_number_1', 'arith_stirling_number_2', 'arith_euler_number', 'bernoulli_fmpq_ui', 'arb_fib_fmpz',
    'fmpz_mod_mat_charpoly', 'acb_set_round', 'arb_set_round', 'fmpz_divexact',
    'fmpz_mpoly_ctx_init', 'fmpz_mpoly_gen', 'fmpz_mpoly_get_term_coeff_fmpz', 'fmpz_mpoly_get_term_exp_ui',
    'fmpz_mpoly_factor', 'fmpq_mpoly_factor', 'fmpq_mpoly_evaluate_all_fmpq', 'fmpq_mpoly_divrem_ideal',
    'fmpz_is_perfect_power', 'fmpz_mod_discrete_log_pohlig_hellman_run', 'fmpq_poly_xgcd', 'fmpz_mod_poly_xgcd',
    'fq_default_poly_xgcd', 'fmpz_poly_factor_squarefree', 'fmpz_mod_poly_factor_squarefree',
    'fq_default_poly_factor_squarefree', 'fmpz_powm', 'arb_floor', 'acb_elliptic_rf', 'acb_elliptic_rg',
    'acb_elliptic_rj', 'arb_hypgeom_beta_lower', 'acb_hypgeom_beta_lower', 'arb_hypgeom_gamma_lower', 'acb_hypgeom_gamma_lower',
    'arb_hypgeom_gamma_upper', 'acb_hypgeom_gamma_upper', 'acb_hypgeom_m', 'acb_hypgeom_0f1', 'acb_hypgeom_pfq',
    'acb_hypgeom_legendre_p', 'acb_hypgeom_legendre_q', 'acb_modular_theta', 'arb_hypgeom_fresnel', 'acb_hypgeom_fresnel',
    'acb_hypgeom_coulomb', 'acb_dirichlet_hardy_z', 'acb_dirichlet_hardy_theta', 'acb_elliptic_f', 'acb_elliptic_e_inc',
    'acb_elliptic_pi_inc', 'acb_calc_integrate', 'acb_sqrt_analytic', 'acb_log_analytic', 'acb_pow_analytic', 'acb_real_abs',
  ]);
  const unknown = [];
  for (const e of REF.values()) for (const f of e.flint) if (!cfuncs.has(f) && !extra.has(f)) unknown.push(`${e.name}:${f}`);
  assert.deepEqual(unknown, []);
});

for (const e of REF.values()) {
  for (const ex of e.examples) {
    test(`exemplo de ${e.name}: ${ex}`, () => {
      const out = evalOne(ex);
      assert.ok(!out.startsWith('ERRO'), out);
    });
  }
}

const ERRORS = [
  '1/0', 'foo(3)', '[1, 2][5]', 'if 1 then 2 else 3', 'GF(6)', '[1, 2; 3]', 'f(n) = f(n + 1); f(1)',
  '[1, 2; 3, 4] * [1, 2, 3;]', 'exp(1) == e', 'sin("a")', '"a" - 1', 'Zmod(12)(4)^-1', 'x = gen(QQ[x]); (x^2 + 1) / (x - 1)',
  'factor(0)', 'match 3 { 1 => 2 }', 'f(1) = 1; f(2)', '1 +', 'det([1, 2, 3])', 'zetazero(0)', 'isprime(1/2)',
  'flint("nope")', 'flint("fmpz_add", 1)', 'x = gen(RR[x]); y = gen(RR[y]); x + y', 'reduce([], (a, b) -> a)',
  'sqrt(Zmod(7)(3))', 'inverse([1, 2; 2, 4])', 'with foo = 1: 2', '"abc', '1 $ 2', 'nextprime()', 'gen(ZZ)',
  'floor(i)', 'len(3)', 'QQ(1, 0)', 'Zmod(1)', 'max([])', '1..10 by 0', 'listplot([1], ylim = [2, 1])',
  'circle(0, -1)', 'circle(0, 1, foo = 2)', 'circle(0, 1, color = "x")', 'point("a")', 'polygon([0, 1])', 'infline(1, 1)',
  'arc(0, 1, 1, 0)', 'circle(0, 1) - 1', 'draw(3)', 'draw(point(0), zoom = 2)', 'point(0, opacity = 2)', 'point(0, dash = "x")',
  'point(0, marker = "x")', 'draw(point(0), aspect = "x")', 'curve(t -> t, 1, 0)', 'rgb(2, 0, 0)', 'arc(0, 1, i, 2)',
  'scale(point(0), 0)', 'transform(point(0), [1, 2, 3; 4, 5, 6])', 'transform(point(0), [1, 2; 2, 4])', 'transform(ray(0, 1), exp)',
  'translate(3, 1)', 'rotate(point(0), "a")',
  '(1, 2) * (3, 4)', '(1, 2) + (1, 2, 3)', '(1, 2) < (3, 4)', '(1, 2) + 1',
  'GF(7)[x, y]', 'QQ[x, x]', 'QQ[x, y, order = "abc"]', 'QQ[x, y, foo = 1]', 'QQ[1, 2]', '[1, 2][1, order = 2]',
  '(x, y) = gens(Zmod(6)[x, y]); factor(x^2 - y^2)', '(x, y) = gens(QQ[x, y]); (x + y)(1)', '(x, y) = gens(QQ[x, y]); (x + y)[1]',
  'gen(QQ[x, y])', 'gen(QQ[x, y], 3)', 'gen(QQ[x, y], "z")', '(x, y) = gens(QQ[x, y]); roots(x*y - 1)',
  '(x, y) = gens(QQ[x, y]); diff(x*y, 2)', '(x, y) = gens(QQ[x, y]); diff(x*y)', '(x, y) = gens(QQ[x, y]); deg(x, x + 1)',
  '(x, y) = gens(QQ[x, y]); coeff(x*y, 2*x)', '(x, y) = gens(QQ[x, y]); coeff(x*y, 1)', '(x, y) = gens(QQ[x, y]); lt(0*x)',
  '(x, y) = gens(QQ[x, y]); resultant(x, y)', '(x, y) = gens(QQ[x, y]); disc(x*y, "z")', '(x, y) = gens(QQ[x, y]); (x^2 + 1)/(x*y + 1)',
  '(x, y) = gens(QQ[x, y]); subs(x, y)', 'x = gen(QQ[x]); disc(x^2, "y")', 'divrem(3, [1])', 'vars(1..3)',
  '(x, y) = gens(QQ[x, y]); flint("fmpz_mpoly_total_degree", x)', 'flint("fmpq_mpoly_total_degree", 1)',
  '(x, y) = gens(QQ[x, y]); (x + y)("a", 1)', '(x, y) = gens(QQ[x, y]); x^-1', 'gens(3)',
  'implicitplot(3)', '(x, y) = gens(Zmod(5)[x, y]); implicitplot(x + y)', '(x, y, z) = gens(QQ[x, y, z]); implicitplot(x + z)',
  '(x, y) = gens(QQ[x, y]); implicitplot(0*x)', '(x, y) = gens(QQ[x, y]); implicitplot(x, resolution = 2)',
  '(x, y) = gens(QQ[x, y]); implicitplot(x, vars = [x, x])',
  'crt([1, 2], [2, 4])', 'crt(Zmod(4)(1), Zmod(6)(2))', 'crt([1], [0])', 'crt([1, 2], [3])', 'crt([1/2], [3])', 'crt([1], [3], 2)',
  'crt([1], [1/2])',
  'ratrecon(5, 7)', 'ratrecon(3)', 'ratrecon(1, 1)', 'contfrac("a")', 'fromcontfrac([])', 'primitiveroot(8)', 'dlog(3, 4, 7)',
  'dlog(3, 2, 8)', 'dlog(0, 2, 7)', 'dlog(3, 2)', 'p = nextprime(2^80); dlog(5, 3, p)', 'xgcd(gen(RR[x]), 1)',
  'x = gen(QQ[x]); sqrt(x^2 + 1)', 'x = gen(Zmod(5)[x]); sqrt(x^2)', 'x = gen(QQ[x]); series(gamma, x, 4)',
  'x = gen(QQ[x]); series(exp, 1 + x, 4)', 'x = gen(QQ[x]); series(log, x, 4)', 'x = gen(QQ[x]); series(inv, x, 4)',
  'x = gen(QQ[x]); series(sqrt, 2 + x, 4)', 'x = gen(QQ[x]); revert(1 + x, 4)', 'x = gen(GF(5)[x]); series(exp, x, 4)',
  'interpolate([1, 2], [1])', 'interpolate([1, 1], [1, 2])', 'interpolate([[1, 2; 3, 4]], [1])', 'sqfree(gen(RR[x]))',
  'eigenvectors([1, 1; 0, 1])',
  'stieltjes(-1)', 'sphericalharmonic(1, 2, 0, 0)', 'jacobitheta(5, 0, i)', 'erfinv(i)', 'erfinv(2)', 'legendreq(1)',
  'gegenbauerc(1)', 'chebyshevt(1, 2, 3)',
  'integrate(3, 0, 1)', 'integrate(t -> t, [1])', 'integrate(t -> t, "a", 1)', 'integrate(t -> "a", 0, 1)',
  'integrate(t -> 1/t, -1, 1)', 'integrate(t -> log(t), 0, 1)', 'integrate(t -> sin(t)/t, 0, 1)',
  'handle(0, snap = -1)', 'handle("a")', 'handles([0, "a"])', 'rationalize(i)', 'rationalize("a")', 'handle(0, on = 3)',
];

test('mensagens de erro têm tradução para inglês', () => {
  setLang('en');
  const untranslated = [];
  for (const src of ERRORS) {
    const out = evalOne(src);
    assert.ok(out.startsWith('ERRO: '), `${src} deveria falhar: ${out}`);
    const msg = out.slice(6);
    const en = translateError(msg);
    if (/[ãçéêíóõú]|\b(não|deve|espera|requer|de|em|com|para)\b/.test(en)) untranslated.push(`${src} -> ${msg} -> ${en}`);
  }
  setLang('pt');
  assert.deepEqual(untranslated, []);
});
