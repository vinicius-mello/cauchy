// Notebooks de exemplo. Títulos e comentários têm versões pt/en.

export const pick = (v, lang) => (typeof v === 'string' ? v : v[lang] ?? v.pt);

export const EXAMPLES = [
  {
    title: { pt: 'Primeiros passos', en: 'First steps' },
    cells: [
      {
        pt: '# Cauchy: exploração numérica com FLINT.\n# Cada célula é recalculada quando algo de que depende muda.\n# Shift+Enter avalia; experimente mudar n abaixo.\nn = 2^128 + 1',
        en: '# Cauchy: numerical exploration with FLINT.\n# Each cell is recomputed when something it depends on changes.\n# Shift+Enter evaluates; try changing n below.\nn = 2^128 + 1',
      },
      'factor(n)',
      'isprime(nextprime(n))',
      { pt: '# Racionais são exatos; reais são bolas com raio de erro garantido.\n1/3 + 1/6', en: '# Rationals are exact; reals are balls with a guaranteed error radius.\n1/3 + 1/6' },
      'with digits = 60: pi',
      'zeta(2) - pi^2/6',
      { pt: '# Funções, padrões e compreensões\nf(0) = 1\nf(n) = n * f(n - 1)', en: '# Functions, patterns and comprehensions\nf(0) = 1\nf(n) = n * f(n - 1)' },
      '[f(k) | k <- 1..10, iseven(k)]',
      '1..100 |> filter(isprime) |> sum',
    ],
  },
  {
    title: { pt: 'Polinômios', en: 'Polynomials' },
    cells: [
      'R = QQ[x]',
      'x = gen(R)',
      'p = x^4 - 10x^2 + 1',
      'factor(p)',
      'roots(p)',
      'q = cyclotomic(12)',
      'gcd(p * (x - 1), q * (x - 1))',
      'divrem(x^5 + 1, x^2 + 1)',
      { pt: '# Polinômios são funções: avaliação e composição\np(1/2), p(x + 1)', en: '# Polynomials are functions: evaluation and composition\np(1/2), p(x + 1)' },
      'k = slider(1, 30)',
      'chebyshevt(k)',
      'plot(t -> chebyshevt(k)(t), -1, 1)',
    ],
  },
  {
    title: { pt: 'Funções especiais', en: 'Special functions' },
    cells: [
      'gamma(1/3)',
      'with digits = 40: besselj(0, 1) + besselj(1, 1)*i',
      'zetazero(1)',
      'polylog(2, 1/2)',
      'plot([t -> besselj(0, t), t -> besselj(1, t)], 0, 20)',
      'plot(t -> gamma(t), -4, 5, ylim = [-10, 10])',
      'kleinj(i)',
      'lambertw(1)',
    ],
  },
  {
    title: { pt: 'FLINT direto', en: 'Raw FLINT' },
    cells: [
      { pt: '# Qualquer função da aba FLINT da referência pode ser chamada\n# diretamente; prec e contexto são preenchidos automaticamente.\nflint("arb_gamma", 1/3)', en: '# Any function from the FLINT tab of the reference can be called\n# directly; prec and context are filled in automatically.\nflint("arb_gamma", 1/3)' },
      'flint("fmpz_bin_uiui", 100, 50)',
      'x = gen(ZZ[x])',
      'flint("fmpz_poly_swinnerton_dyer", 3)',
      'flint("fmpz_poly_discriminant", x^5 - x - 1)',
      'F = GF(3^4)',
      'flint("fq_frobenius", gen(F)^5, 2)',
      'with digits = 40: flint("acb_modular_j", (1 + sqrt(-163))/2)',
    ],
  },
  {
    title: { pt: 'Matrizes', en: 'Matrices' },
    cells: [
      'A = [2, 1, 0; 1, 3, 1; 0, 1, 4]',
      'det(A), rank(A), trace(A)',
      'inverse(A)',
      'charpoly(A)',
      'eigenvalues(A)',
      'H = matrix(6, 6, (i, j) -> 1/(i + j - 1))',
      'det(H)',
      'solve(A, [1, 2, 3])',
      'lll([1, 0, 0, 31416; 0, 1, 0, 27183; 0, 0, 1, 14142])',
    ],
  },
  {
    title: { pt: 'Corpos finitos', en: 'Finite fields' },
    cells: [
      'F = GF(2^8)',
      'a = gen(F)',
      'modulus(F)',
      'order(a), isgenerator(a)',
      'a^200 + a^3',
      'y = gen(F[y])',
      'factor(y^5 + y + 1)',
      'p = 101',
      'R = Zmod(p)',
      '[r | r <- elements(R), r^2 == R(-1)]',
    ],
  },
];
