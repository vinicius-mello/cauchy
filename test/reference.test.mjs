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
  'flint("nope")', 'flint("fmpz_add", 1)', 'x = gen(QQ[x]); y = gen(QQ[y]); x + y', 'reduce([], (a, b) -> a)',
  'sqrt(Zmod(7)(3))', 'inverse([1, 2; 2, 4])', 'with foo = 1: 2', '"abc', '1 $ 2', 'nextprime()', 'gen(ZZ)',
  'floor(i)', 'len(3)', 'QQ(1, 0)', 'Zmod(1)', 'max([])', '1..10 by 0',
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
