// Referência detalhada das funções embutidas, em português e inglês.
// Cada linha: nome ¦ categoria ¦ assinatura ¦ descrição pt ¦ descrição en ¦
//             exemplos (separados por " ;; ") ¦ funções FLINT usadas

export const CATEGORIES = [
  ['rings', 'Anéis e conversões', 'Rings and conversions'],
  ['arith', 'Aritmética', 'Arithmetic'],
  ['nt', 'Teoria dos números', 'Number theory'],
  ['comb', 'Combinatória e sequências', 'Combinatorics and sequences'],
  ['elem', 'Funções elementares', 'Elementary functions'],
  ['special', 'Funções especiais', 'Special functions'],
  ['ball', 'Bolas e precisão', 'Balls and precision'],
  ['poly', 'Polinômios', 'Polynomials'],
  ['mat', 'Matrizes', 'Matrices'],
  ['ff', 'Corpos finitos e ℤ/nℤ', 'Finite fields and ℤ/nℤ'],
  ['list', 'Listas e funções de ordem superior', 'Lists and higher-order functions'],
  ['plot', 'Gráficos e widgets', 'Plots and widgets'],
  ['draw', 'Desenho: primitivas e atributos', 'Drawing: primitives and attributes'],
  ['misc', 'Diversos', 'Miscellaneous'],
];

const RAW = `
ZZ ¦ rings ¦ ZZ, ZZ(x) ¦ Anel dos inteiros ℤ. Chamado como função, converte racionais inteiros, bolas que contêm um único inteiro, elementos de ℤ/nℤ e strings. ¦ The ring of integers ℤ. Called as a function, converts integral rationals, balls containing a single integer, elements of ℤ/nℤ and strings. ¦ ZZ(10/5) ;; ZZ("123456789012345678901234567890") ;; ZZ(Zmod(7)(-1)) ¦ fmpz_set_str arb_get_unique_fmpz
QQ ¦ rings ¦ QQ, QQ(x), QQ(a, b) ¦ Corpo dos racionais ℚ (exatos). QQ(a, b) = a/b. ¦ The field of rationals ℚ (exact). QQ(a, b) = a/b. ¦ QQ(3, 6) ;; QQ("22/7") ;; QQ[x] ¦ fmpq_canonicalise
RR ¦ rings ¦ RR, RR(x) ¦ Números reais como bolas da Arb: ponto médio + raio, com garantia de que o valor exato está contido. ¦ Real numbers as Arb balls: midpoint + radius, with the guarantee that the exact value is enclosed. ¦ RR(1/3) ;; RR("0.1") ¦ arb_set_fmpq arb_set_str
CC ¦ rings ¦ CC, CC(x), CC(re, im) ¦ Números complexos como pares de bolas (acb). ¦ Complex numbers as pairs of balls (acb). ¦ CC(1, 2) ;; CC(1/3) ¦ acb_set_arb_arb
Zmod ¦ rings ¦ Zmod(n) ¦ Anel ℤ/nℤ. Elementos se criam chamando o anel: Zmod(n)(k). ¦ The ring ℤ/nℤ. Create elements by calling the ring: Zmod(n)(k). ¦ R = Zmod(12); R(5) * 7 ;; Zmod(7)(3) / 5 ¦ fmpz_mod_ctx_init fmpz_mod_set_fmpz
GF ¦ rings ¦ GF(q), GF(p, k), GF(q, var="a") ¦ Corpo finito com q = pᵏ elementos. Use gen(F) para o gerador. ¦ Finite field with q = pᵏ elements. Use gen(F) for the generator. ¦ F = GF(3^4); a = gen(F); a^10 ;; GF(101) ¦ fq_default_ctx_init fq_default_gen
Mat ¦ rings ¦ Mat(R) ¦ Espaço de matrizes sobre R; Mat(R)(A) converte uma matriz. ¦ Space of matrices over R; Mat(R)(A) converts a matrix. ¦ Mat(QQ)([1, 2; 3, 4]) ;; Mat(Zmod(5))([1, 2; 3, 4]) ¦ fmpq_mat_set_fmpz_mat fmpz_mod_mat_set_fmpz_mat
gen ¦ rings ¦ gen(R) ¦ Gerador de um anel de polinômios R[x] (a variável x) ou de GF(q). ¦ Generator of a polynomial ring R[x] (the variable x) or of GF(q). ¦ x = gen(QQ[x]); x^2 + 1 ;; gen(GF(2^8)) ¦ fmpz_poly_set_coeff_fmpz fq_default_gen
ring ¦ rings ¦ ring(x) ¦ Anel ao qual o valor pertence. ¦ The ring a value belongs to. ¦ ring(1/2) ;; ring(sqrt(2)) ;; ring([1, 2; 3, 4]) ¦
base ¦ rings ¦ base(R) ¦ Anel de coeficientes de R[x] ou de Mat(R). ¦ Coefficient ring of R[x] or Mat(R). ¦ base(QQ[x]) ¦
characteristic ¦ rings ¦ characteristic(R) ¦ Característica do anel. ¦ Characteristic of the ring. ¦ characteristic(GF(7^2)) ;; characteristic(QQ) ¦
lift ¦ rings ¦ lift(x) ¦ Representante inteiro de um elemento de ℤ/nℤ, ou polinômio inteiro de um elemento de GF(q) (também para polinômios e matrizes sobre ℤ/nℤ). ¦ Integer representative of an element of ℤ/nℤ, or integer polynomial of an element of GF(q) (also for polynomials and matrices over ℤ/nℤ). ¦ lift(Zmod(7)(-1)) ;; F = GF(9); lift(gen(F)^5) ¦ fq_default_get_fmpz_poly fmpz_mod_poly_get_fmpz_poly
abs ¦ arith ¦ abs(x) ¦ Valor absoluto (exato para inteiros e racionais; módulo para complexos). ¦ Absolute value (exact for integers and rationals; modulus for complex numbers). ¦ abs(-3/4) ;; abs(3 + 4i) ¦ fmpz_abs fmpq_abs arb_abs acb_abs
sign ¦ arith ¦ sign(x) ¦ Sinal: −1, 0 ou 1. Para bolas, erro se o sinal não for decidível. ¦ Sign: −1, 0 or 1. For balls, an error if the sign is undecidable. ¦ sign(-7) ;; sign(pi - 3) ¦ fmpz_sgn fmpq_sgn arb_lt
floor ¦ arith ¦ floor(x) ¦ Maior inteiro ≤ x. ¦ Largest integer ≤ x. ¦ floor(-7/2) ;; floor(pi^10) ¦ fmpz_fdiv_q arb_floor arb_get_unique_fmpz
ceil ¦ arith ¦ ceil(x) ¦ Menor inteiro ≥ x. ¦ Smallest integer ≥ x. ¦ ceil(7/2) ;; ceil(exp(10)) ¦ arb_ceil arb_get_unique_fmpz
round ¦ arith ¦ round(x) ¦ Inteiro mais próximo (metades para cima). ¦ Nearest integer (halves round up). ¦ round(5/2) ;; round(exp(pi * sqrt(163))) ¦ fmpz_fdiv_q
num ¦ arith ¦ num(q) ¦ Numerador de um racional. ¦ Numerator of a rational. ¦ num(6/4) ¦
den ¦ arith ¦ den(q) ¦ Denominador de um racional. ¦ Denominator of a rational. ¦ den(6/4) ¦
mod ¦ arith ¦ mod(a, b) = a % b ¦ Resto da divisão com quociente arredondado para baixo (inteiros); resto euclidiano (polinômios). ¦ Remainder of division with floored quotient (integers); Euclidean remainder (polynomials). ¦ mod(-7, 3) ;; x = gen(QQ[x]); mod(x^5, x^2 + 1) ¦ fmpz_fdiv_r fmpq_poly_divrem
div ¦ arith ¦ div(a, b) = a // b ¦ Quociente arredondado para baixo; quociente euclidiano para polinômios. ¦ Floored quotient; Euclidean quotient for polynomials. ¦ div(-7, 3) ;; 17 // 5 ¦ fmpz_fdiv_q
divrem ¦ arith ¦ divrem(a, b) ¦ Par (q, r) com a = q·b + r. ¦ Pair (q, r) with a = q·b + r. ¦ divrem(17, 5) ;; x = gen(QQ[x]); divrem(x^3 + 1, x - 2) ¦ fmpz_fdiv_qr fmpq_poly_divrem fmpz_mod_poly_divrem fq_default_poly_divrem arb_poly_divrem
quo ¦ arith ¦ quo(a, b) ¦ Quociente euclidiano. ¦ Euclidean quotient. ¦ x = gen(QQ[x]); quo(x^3, x - 1) ¦ fmpq_poly_divrem
rem ¦ arith ¦ rem(a, b) ¦ Resto euclidiano. ¦ Euclidean remainder. ¦ x = gen(QQ[x]); rem(x^3, x - 1) ¦ fmpq_poly_divrem
inv ¦ arith ¦ inv(x) ¦ Inverso multiplicativo (racional, real, ℤ/nℤ, GF(q), matriz). ¦ Multiplicative inverse (rational, real, ℤ/nℤ, GF(q), matrix). ¦ inv(7) ;; inv(Zmod(10)(3)) ;; inv([2, 1; 1, 1]) ¦ fmpq_inv fmpz_mod_inv fq_default_inv fmpq_mat_inv
factor ¦ nt ¦ factor(x) ¦ Fatoração de inteiros (com sinal), racionais (expoentes negativos) e polinômios sobre ℤ, ℚ, ℤ/pℤ e GF(q). O resultado é uma lista de pares (fator, expoente), exibida como produto. ¦ Factorization of integers (with sign), rationals (negative exponents) and polynomials over ℤ, ℚ, ℤ/pℤ and GF(q). The result is a list of (factor, exponent) pairs, shown as a product. ¦ factor(2^128 + 1) ;; factor(-360/49) ;; x = gen(ZZ[x]); factor(x^8 - 1) ;; x = gen(GF(2)[x]); factor(x^15 - 1) ¦ fmpz_factor fmpz_poly_factor fmpz_mod_poly_factor fq_default_poly_factor
isprime ¦ nt ¦ isprime(n) ¦ Teste de primalidade com prova (não probabilístico). ¦ Primality test with proof (not probabilistic). ¦ isprime(2^127 - 1) ;; filter(1..50, isprime) ¦ fmpz_is_prime
isprobprime ¦ nt ¦ isprobprime(n) ¦ Teste provável BPSW (muito rápido, sem contraexemplos conhecidos). ¦ BPSW probable-prime test (very fast, no known counterexamples). ¦ isprobprime(2^4423 - 1) ¦ fmpz_is_probabprime
nextprime ¦ nt ¦ nextprime(n) ¦ Menor primo maior que n. ¦ Smallest prime greater than n. ¦ nextprime(10^30) ¦ fmpz_nextprime
prevprime ¦ nt ¦ prevprime(n) ¦ Maior primo menor que n. ¦ Largest prime smaller than n. ¦ prevprime(1000) ¦ fmpz_is_prime
prime ¦ nt ¦ prime(n) ¦ O n-ésimo primo (n cabe em 32 bits). ¦ The n-th prime (n fits in 32 bits). ¦ prime(1000) ;; [prime(k) | k <- 1..10] ¦ n_nth_prime
primepi ¦ nt ¦ primepi(x) ¦ Número de primos ≤ x. ¦ Number of primes ≤ x. ¦ primepi(10^6) ¦ n_prime_pi
primes ¦ nt ¦ primes(n), primes(a, b) ¦ Lista dos primos ≤ n ou no intervalo [a, b]. ¦ List of primes ≤ n or in the interval [a, b]. ¦ primes(50) ;; primes(10^12, 10^12 + 100) ¦ fmpz_nextprime
gcd ¦ nt ¦ gcd(a, b, …), gcd(lista) ¦ Máximo divisor comum de inteiros ou polinômios. ¦ Greatest common divisor of integers or polynomials. ¦ gcd(12, 18, 27) ;; x = gen(QQ[x]); gcd(x^2 - 1, x^3 - 1) ¦ fmpz_gcd fmpz_poly_gcd fmpq_poly_gcd fmpz_mod_poly_gcd fq_default_poly_gcd
lcm ¦ nt ¦ lcm(a, b, …), lcm(lista) ¦ Mínimo múltiplo comum. ¦ Least common multiple. ¦ lcm(1..20) ¦ fmpz_lcm fmpz_poly_lcm fmpq_poly_lcm
xgcd ¦ nt ¦ xgcd(a, b) ¦ Tupla (g, s, t) com g = gcd(a, b) = s·a + t·b. ¦ Tuple (g, s, t) with g = gcd(a, b) = s·a + t·b. ¦ xgcd(240, 46) ¦ fmpz_xgcd
powmod ¦ nt ¦ powmod(a, e, m) ¦ aᵉ mod m (e pode ser negativo se a for inversível). ¦ aᵉ mod m (e may be negative if a is invertible). ¦ powmod(2, 10^18, 10^9 + 7) ¦ fmpz_powm fmpz_invmod
invmod ¦ nt ¦ invmod(a, m) ¦ Inverso de a módulo m. ¦ Inverse of a modulo m. ¦ invmod(17, 3120) ¦ fmpz_invmod
eulerphi ¦ nt ¦ eulerphi(n) ¦ Função totiente φ de Euler. Também: φ. ¦ Euler's totient function φ. Also: φ. ¦ eulerphi(36) ;; map(1..12, φ) ¦ fmpz_euler_phi
moebius ¦ nt ¦ moebius(n) ¦ Função μ de Möbius. Também: μ. ¦ Möbius function μ. Also: μ. ¦ map(1..12, moebius) ¦ fmpz_moebius_mu
sigma ¦ nt ¦ sigma(n), sigma(n, k) ¦ Soma das k-ésimas potências dos divisores (k = 1 por padrão). ¦ Sum of the k-th powers of the divisors (k = 1 by default). ¦ sigma(28) ;; sigma(12, 2) ¦ fmpz_divisor_sigma
divisors ¦ nt ¦ divisors(n) ¦ Divisores positivos em ordem crescente. ¦ Positive divisors in increasing order. ¦ divisors(360) ¦ fmpz_factor
numdivisors ¦ nt ¦ numdivisors(n) ¦ Número de divisores positivos. ¦ Number of positive divisors. ¦ numdivisors(720720) ¦ fmpz_divisor_sigma
jacobi ¦ nt ¦ jacobi(a, n) ¦ Símbolo de Jacobi (a/n), n ímpar positivo. ¦ Jacobi symbol (a/n), n odd positive. ¦ jacobi(2, 15) ¦ fmpz_jacobi
isqrt ¦ nt ¦ isqrt(n) ¦ ⌊√n⌋ exato. ¦ Exact ⌊√n⌋. ¦ isqrt(10^41) ¦ fmpz_sqrt
iroot ¦ nt ¦ iroot(n, k) ¦ ⌊n^(1/k)⌋ exato. ¦ Exact ⌊n^(1/k)⌋. ¦ iroot(10^30, 7) ¦ fmpz_root
issquare ¦ nt ¦ issquare(n) ¦ n é quadrado perfeito? ¦ Is n a perfect square? ¦ issquare(2^100) ¦ fmpz_is_square
iseven ¦ nt ¦ iseven(n) ¦ n é par? ¦ Is n even? ¦ filter(1..10, iseven) ¦ fmpz_is_even
isodd ¦ nt ¦ isodd(n) ¦ n é ímpar? ¦ Is n odd? ¦ filter(1..10, isodd) ¦ fmpz_is_odd
divides ¦ nt ¦ divides(d, n) ¦ d divide n? ¦ Does d divide n? ¦ divides(7, 91) ¦ fmpz_divisible
valuation ¦ nt ¦ valuation(n, p) ¦ Maior k com pᵏ | n. ¦ Largest k with pᵏ | n. ¦ valuation(100!, 5) ¦ fmpz_divisible fmpz_divexact
digits ¦ nt ¦ digits(n), digits(n, b) ¦ Dígitos de |n| na base b, do menos para o mais significativo. ¦ Digits of |n| in base b, least significant first. ¦ digits(2^20) ;; sum(digits(2^1000)) ¦ fmpz_get_str
numdigits ¦ nt ¦ numdigits(n), numdigits(n, b) ¦ Quantidade de dígitos na base b. ¦ Number of digits in base b. ¦ numdigits(1000!) ¦ fmpz_get_str
bits ¦ nt ¦ bits(n) ¦ Tamanho de |n| em bits. ¦ Size of |n| in bits. ¦ bits(10^100) ¦ fmpz_bits
tobase ¦ nt ¦ tobase(n, b) ¦ String de n na base b (2 a 62). ¦ String of n in base b (2 to 62). ¦ tobase(255, 2) ;; tobase(2^64, 36) ¦ fmpz_get_str
frombase ¦ nt ¦ frombase(s, b) ¦ Inteiro a partir de uma string na base b. ¦ Integer from a string in base b. ¦ frombase("ff", 16) ¦ fmpz_set_str
dedekindsum ¦ nt ¦ dedekindsum(h, k) ¦ Soma de Dedekind s(h, k). ¦ Dedekind sum s(h, k). ¦ dedekindsum(3, 7) ¦ fmpq_dedekind_sum
random ¦ nt ¦ random(n) ¦ Inteiro aleatório uniforme em [0, n). ¦ Uniform random integer in [0, n). ¦ random(10^20) ¦ fmpz_randm
factorial ¦ comb ¦ factorial(n) = n! ¦ Fatorial exato; para argumentos não inteiros, Γ(n + 1). ¦ Exact factorial; for non-integer arguments, Γ(n + 1). ¦ 30! ;; factorial(1/2) ¦ fmpz_fac_ui arb_gamma
binomial ¦ comb ¦ binomial(n, k) ¦ Coeficiente binomial (n também pode ser negativo). ¦ Binomial coefficient (n may also be negative). ¦ binomial(100, 50) ;; binomial(-3, 2) ¦ fmpz_bin_uiui
fib ¦ comb ¦ fib(n) ¦ Número de Fibonacci Fₙ. ¦ Fibonacci number Fₙ. ¦ fib(1000) ¦ fmpz_fib_ui
lucas ¦ comb ¦ lucas(n) ¦ Número de Lucas Lₙ. ¦ Lucas number Lₙ. ¦ map(0..10, lucas) ¦ fmpz_fib_ui
primorial ¦ comb ¦ primorial(n) ¦ Produto dos primos ≤ n. ¦ Product of the primes ≤ n. ¦ primorial(100) ¦ fmpz_primorial
partitions ¦ comb ¦ partitions(n) ¦ Número de partições p(n) (algoritmo de Hardy–Ramanujan–Rademacher). ¦ Number of partitions p(n) (Hardy–Ramanujan–Rademacher algorithm). ¦ partitions(10^6) ¦ partitions_fmpz_fmpz
bell ¦ comb ¦ bell(n) ¦ Número de Bell Bₙ. ¦ Bell number Bₙ. ¦ map(0..10, bell) ¦ arith_bell_number
stirling1 ¦ comb ¦ stirling1(n, k) ¦ Número de Stirling de primeira espécie (com sinal). ¦ Signed Stirling number of the first kind. ¦ stirling1(10, 3) ¦ arith_stirling_number_1
stirling2 ¦ comb ¦ stirling2(n, k) ¦ Número de Stirling de segunda espécie. ¦ Stirling number of the second kind. ¦ stirling2(10, 3) ¦ arith_stirling_number_2
eulernumber ¦ comb ¦ eulernumber(n) ¦ Número de Euler Eₙ. ¦ Euler number Eₙ. ¦ eulernumber(10) ¦ arith_euler_number
bernoulli ¦ comb ¦ bernoulli(n) ¦ Número de Bernoulli Bₙ (racional exato). ¦ Bernoulli number Bₙ (exact rational). ¦ bernoulli(100) ¦ bernoulli_fmpq_ui
harmonic ¦ comb ¦ harmonic(n) ¦ Número harmônico Hₙ = 1 + 1/2 + … + 1/n. ¦ Harmonic number Hₙ = 1 + 1/2 + … + 1/n. ¦ harmonic(30) ¦ fmpq_harmonic_ui
fibr ¦ comb ¦ fibr(n) ¦ Fₙ como bola real (útil para n enorme). ¦ Fₙ as a real ball (useful for huge n). ¦ fibr(10^30) ¦ arb_fib_fmpz
sqrt ¦ elem ¦ sqrt(x), √x ¦ Raiz quadrada: exata para quadrados perfeitos, bola real ou complexa caso contrário; em ℤ/pℤ e GF(q), raiz no corpo. ¦ Square root: exact for perfect squares, real or complex ball otherwise; in ℤ/pℤ and GF(q), a root in the field. ¦ sqrt(2) ;; √(9/4) ;; sqrt(-1) ;; sqrt(Zmod(13)(10)) ¦ arb_sqrt acb_sqrt fmpz_sqrtmod fq_default_sqrt
cbrt ¦ elem ¦ cbrt(x) ¦ Raiz cúbica real (exata para cubos perfeitos). ¦ Real cube root (exact for perfect cubes). ¦ cbrt(-27) ;; cbrt(2) ¦ arb_root_ui
root ¦ elem ¦ root(x, k) ¦ Raiz k-ésima principal. ¦ Principal k-th root. ¦ root(2, 12) ¦ arb_root_ui acb_root_ui
exp ¦ elem ¦ exp(x) ¦ Exponencial. ¦ Exponential. ¦ exp(1) ;; exp(i*pi) ¦ arb_exp acb_exp
expm1 ¦ elem ¦ expm1(x) ¦ exp(x) − 1 preciso perto de 0. ¦ exp(x) − 1, accurate near 0. ¦ expm1(10^-20) ¦ arb_expm1
log ¦ elem ¦ log(x), log(x, b) ¦ Logaritmo natural (ou na base b). Argumentos negativos dão o valor principal complexo. Também: ln. ¦ Natural logarithm (or base b). Negative arguments give the principal complex value. Also: ln. ¦ log(2) ;; log(-1) ;; log(1024, 2) ¦ arb_log acb_log
log1p ¦ elem ¦ log1p(x) ¦ log(1 + x) preciso perto de 0. ¦ log(1 + x), accurate near 0. ¦ log1p(10^-30) ¦ arb_log1p
log2 ¦ elem ¦ log2(x) ¦ Logaritmo na base 2. ¦ Base-2 logarithm. ¦ log2(10) ¦ arb_log arb_const_log2
log10 ¦ elem ¦ log10(x) ¦ Logaritmo na base 10. ¦ Base-10 logarithm. ¦ log10(2) ¦ arb_log_base_ui
sin ¦ elem ¦ sin(x) ¦ Seno (real ou complexo). Também cos, tan, cot, sec, csc. ¦ Sine (real or complex). Also cos, tan, cot, sec, csc. ¦ sin(pi/6) ;; sin(1 + i) ¦ arb_sin acb_sin
cos ¦ elem ¦ cos(x) ¦ Cosseno. ¦ Cosine. ¦ cos(1) ¦ arb_cos acb_cos
tan ¦ elem ¦ tan(x) ¦ Tangente. ¦ Tangent. ¦ tan(pi/4) ¦ arb_tan acb_tan
cot ¦ elem ¦ cot(x) ¦ Cotangente. ¦ Cotangent. ¦ cot(1) ¦ arb_cot acb_cot
sec ¦ elem ¦ sec(x) ¦ Secante. ¦ Secant. ¦ sec(1) ¦ arb_sec
csc ¦ elem ¦ csc(x) ¦ Cossecante. ¦ Cosecant. ¦ csc(1) ¦ arb_csc
sinpi ¦ elem ¦ sinpi(x) ¦ sin(πx), exato nos inteiros. ¦ sin(πx), exact at integers. ¦ sinpi(1/6) ¦ arb_sin_pi
cospi ¦ elem ¦ cospi(x) ¦ cos(πx). ¦ cos(πx). ¦ cospi(1/3) ¦ arb_cos_pi
sinc ¦ elem ¦ sinc(x) ¦ sin(x)/x. ¦ sin(x)/x. ¦ sinc(0) ¦ arb_sinc acb_sinc
asin ¦ elem ¦ asin(x) ¦ Arco-seno (complexo fora de [−1, 1]). Também acos, atan. ¦ Arcsine (complex outside [−1, 1]). Also acos, atan. ¦ asin(1) ;; asin(2) ¦ arb_asin acb_asin
acos ¦ elem ¦ acos(x) ¦ Arco-cosseno. ¦ Arccosine. ¦ acos(0) ¦ arb_acos acb_acos
atan ¦ elem ¦ atan(x) ¦ Arco-tangente. ¦ Arctangent. ¦ 4atan(1) ¦ arb_atan acb_atan
atan2 ¦ elem ¦ atan2(y, x) ¦ Ângulo do ponto (x, y). ¦ Angle of the point (x, y). ¦ atan2(1, -1) ¦ arb_atan2
sinh ¦ elem ¦ sinh(x) ¦ Seno hiperbólico. Também cosh, tanh, asinh, acosh, atanh. ¦ Hyperbolic sine. Also cosh, tanh, asinh, acosh, atanh. ¦ sinh(1) ¦ arb_sinh acb_sinh
cosh ¦ elem ¦ cosh(x) ¦ Cosseno hiperbólico. ¦ Hyperbolic cosine. ¦ cosh(1) ¦ arb_cosh acb_cosh
tanh ¦ elem ¦ tanh(x) ¦ Tangente hiperbólica. ¦ Hyperbolic tangent. ¦ tanh(1) ¦ arb_tanh acb_tanh
asinh ¦ elem ¦ asinh(x) ¦ Arco-seno hiperbólico. ¦ Inverse hyperbolic sine. ¦ asinh(1) ¦ arb_asinh acb_asinh
acosh ¦ elem ¦ acosh(x) ¦ Arco-cosseno hiperbólico. ¦ Inverse hyperbolic cosine. ¦ acosh(2) ¦ arb_acosh acb_acosh
atanh ¦ elem ¦ atanh(x) ¦ Arco-tangente hiperbólica. ¦ Inverse hyperbolic tangent. ¦ atanh(1/2) ¦ arb_atanh acb_atanh
re ¦ elem ¦ re(z) ¦ Parte real. ¦ Real part. ¦ re(exp(i)) ¦ acb_get_real
im ¦ elem ¦ im(z) ¦ Parte imaginária. ¦ Imaginary part. ¦ im(exp(i)) ¦ acb_get_imag
conj ¦ elem ¦ conj(z) ¦ Conjugado complexo. ¦ Complex conjugate. ¦ conj(1 + 2i) ¦ acb_conj
arg ¦ elem ¦ arg(z) ¦ Argumento (ângulo) de z. ¦ Argument (angle) of z. ¦ arg(-1) ¦ acb_arg
complex ¦ elem ¦ complex(a, b) ¦ a + b·i. ¦ a + b·i. ¦ complex(1, 2) ¦ acb_set_arb_arb
gamma ¦ special ¦ gamma(x), Γ(x) ¦ Função gama (inteiros positivos dão o fatorial exato). ¦ Gamma function (positive integers give the exact factorial). ¦ gamma(1/2)^2 ;; Γ(1 + i) ¦ arb_gamma acb_gamma fmpz_fac_ui
lgamma ¦ special ¦ lgamma(x) ¦ log Γ(x) (ramo principal no plano complexo). ¦ log Γ(x) (principal branch in the complex plane). ¦ lgamma(1000) ¦ arb_lgamma acb_lgamma
rgamma ¦ special ¦ rgamma(x) ¦ 1/Γ(x) (inteira, zero nos polos de Γ). ¦ 1/Γ(x) (entire, zero at the poles of Γ). ¦ rgamma(-3) ¦ arb_rgamma acb_rgamma
digamma ¦ special ¦ digamma(x), ψ(x) ¦ Função digama ψ = Γ′/Γ. ¦ Digamma function ψ = Γ′/Γ. ¦ -digamma(1) ¦ arb_digamma acb_digamma
beta ¦ special ¦ beta(a, b) ¦ Função beta Γ(a)Γ(b)/Γ(a+b). ¦ Beta function Γ(a)Γ(b)/Γ(a+b). ¦ beta(1/2, 1/2) ¦ arb_gamma
zeta ¦ special ¦ zeta(s), zeta(s, a), ζ(s) ¦ Zeta de Riemann; com dois argumentos, zeta de Hurwitz ζ(s, a). ¦ Riemann zeta; with two arguments, the Hurwitz zeta ζ(s, a). ¦ zeta(3) ;; zeta(1/2 + 14i) ;; zeta(2, 1/3) ¦ arb_zeta acb_zeta arb_hurwitz_zeta acb_hurwitz_zeta
eta ¦ special ¦ eta(s) ¦ Função eta de Dirichlet η(s) = (1 − 2¹⁻ˢ) ζ(s). ¦ Dirichlet eta function η(s) = (1 − 2¹⁻ˢ) ζ(s). ¦ eta(1) ¦ acb_dirichlet_eta
zetazero ¦ special ¦ zetazero(n) ¦ n-ésimo zero não trivial de ζ na reta crítica (n ≥ 1), isolado rigorosamente. ¦ n-th nontrivial zero of ζ on the critical line (n ≥ 1), rigorously isolated. ¦ zetazero(1) ;; im(zetazero(10^6)) ¦ acb_dirichlet_zeta_zero
polylog ¦ special ¦ polylog(s, z) ¦ Polilogaritmo Liₛ(z). ¦ Polylogarithm Liₛ(z). ¦ polylog(2, 1/2) ¦ acb_polylog
agm ¦ special ¦ agm(a, b) ¦ Média aritmético-geométrica. ¦ Arithmetic-geometric mean. ¦ agm(1, sqrt(2)) ¦ arb_agm acb_agm
erf ¦ special ¦ erf(x) ¦ Função erro. ¦ Error function. ¦ erf(1) ¦ arb_hypgeom_erf acb_hypgeom_erf
erfc ¦ special ¦ erfc(x) ¦ Função erro complementar. ¦ Complementary error function. ¦ erfc(10) ¦ arb_hypgeom_erfc acb_hypgeom_erfc
erfi ¦ special ¦ erfi(x) ¦ Função erro imaginária. ¦ Imaginary error function. ¦ erfi(1) ¦ arb_hypgeom_erfi
ei ¦ special ¦ ei(x) ¦ Integral exponencial Ei(x). ¦ Exponential integral Ei(x). ¦ ei(1) ¦ arb_hypgeom_ei acb_hypgeom_ei
si ¦ special ¦ si(x) ¦ Seno integral Si(x). ¦ Sine integral Si(x). ¦ si(pi) ¦ arb_hypgeom_si
ci ¦ special ¦ ci(x) ¦ Cosseno integral Ci(x). ¦ Cosine integral Ci(x). ¦ ci(1) ¦ arb_hypgeom_ci
li ¦ special ¦ li(x) ¦ Logaritmo integral li(x). ¦ Logarithmic integral li(x). ¦ li(10^10) ;; primepi(10^6) - li(10^6) ¦ arb_hypgeom_li
besselj ¦ special ¦ besselj(ν, x) ¦ Função de Bessel de primeira espécie Jᵥ(x). ¦ Bessel function of the first kind Jᵥ(x). ¦ besselj(0, 1) ;; plot(t -> besselj(2, t), 0, 30) ¦ arb_hypgeom_bessel_j acb_hypgeom_bessel_j
bessely ¦ special ¦ bessely(ν, x) ¦ Função de Bessel de segunda espécie Yᵥ(x). ¦ Bessel function of the second kind Yᵥ(x). ¦ bessely(0, 1) ¦ arb_hypgeom_bessel_y acb_hypgeom_bessel_y
besseli ¦ special ¦ besseli(ν, x) ¦ Função de Bessel modificada Iᵥ(x). ¦ Modified Bessel function Iᵥ(x). ¦ besseli(0, 1) ¦ arb_hypgeom_bessel_i acb_hypgeom_bessel_i
besselk ¦ special ¦ besselk(ν, x) ¦ Função de Bessel modificada Kᵥ(x). ¦ Modified Bessel function Kᵥ(x). ¦ besselk(0, 1) ¦ arb_hypgeom_bessel_k acb_hypgeom_bessel_k
airyai ¦ special ¦ airyai(x) ¦ Função de Airy Ai(x). ¦ Airy function Ai(x). ¦ plot(airyai, -15, 3) ¦ arb_hypgeom_airy acb_hypgeom_airy
airybi ¦ special ¦ airybi(x) ¦ Função de Airy Bi(x). ¦ Airy function Bi(x). ¦ airybi(0) ¦ arb_hypgeom_airy acb_hypgeom_airy
lambertw ¦ special ¦ lambertw(x), lambertw(x, k) ¦ Função W de Lambert, ramo principal ou ramo k. ¦ Lambert W function, principal branch or branch k. ¦ lambertw(1) ;; lambertw(-1, -1) ¦ arb_lambertw acb_lambertw
gammainc ¦ special ¦ gammainc(s, x) ¦ Gama incompleta superior Γ(s, x). ¦ Upper incomplete gamma Γ(s, x). ¦ gammainc(1/2, 2) ¦ arb_hypgeom_gamma_upper acb_hypgeom_gamma_upper
hyp2f1 ¦ special ¦ hyp2f1(a, b, c, z) ¦ Função hipergeométrica de Gauss ₂F₁(a, b; c; z). ¦ Gauss hypergeometric function ₂F₁(a, b; c; z). ¦ hyp2f1(1/2, 1/2, 1, 1/2) ¦ acb_hypgeom_2f1
kleinj ¦ special ¦ kleinj(τ) ¦ Invariante j de Klein, Im τ > 0. ¦ Klein's j-invariant, Im τ > 0. ¦ kleinj(i) ;; kleinj((1 + sqrt(-163))/2) ¦ acb_modular_j
dedekindeta ¦ special ¦ dedekindeta(τ) ¦ Função η de Dedekind. ¦ Dedekind eta function. ¦ dedekindeta(i) ¦ acb_modular_eta
modlambda ¦ special ¦ modlambda(τ) ¦ Função λ modular. ¦ Modular lambda function. ¦ modlambda(i) ¦ acb_modular_lambda
modulardelta ¦ special ¦ modulardelta(τ) ¦ Discriminante modular Δ(τ). ¦ Modular discriminant Δ(τ). ¦ modulardelta(i) ¦ acb_modular_delta
ellipk ¦ special ¦ ellipk(m) ¦ Integral elíptica completa de primeira espécie K(m). ¦ Complete elliptic integral of the first kind K(m). ¦ ellipk(1/2) ¦ acb_elliptic_k
ellipe ¦ special ¦ ellipe(m) ¦ Integral elíptica completa de segunda espécie E(m). ¦ Complete elliptic integral of the second kind E(m). ¦ ellipe(1/2) ¦ acb_elliptic_e
weierstrassp ¦ special ¦ weierstrassp(z, τ) ¦ Função ℘ de Weierstrass com reticulado (1, τ). ¦ Weierstrass ℘ function with lattice (1, τ). ¦ weierstrassp(1/2, i) ¦ acb_elliptic_p
barnesg ¦ special ¦ barnesg(z) ¦ Função G de Barnes. ¦ Barnes G-function. ¦ barnesg(5) ¦ acb_barnes_g
pi ¦ ball ¦ pi, π ¦ π na precisão corrente. ¦ π at the current precision. ¦ with digits = 100: pi ¦ arb_const_pi
e ¦ ball ¦ e ¦ Número de Euler e na precisão corrente. ¦ Euler's number e at the current precision. ¦ e^(i*pi) ¦ arb_const_e
i ¦ ball ¦ i ¦ Unidade imaginária. ¦ Imaginary unit. ¦ i^2 ;; (1 + i)^8 ¦ acb_onei
euler ¦ ball ¦ euler, γ ¦ Constante de Euler–Mascheroni. ¦ Euler–Mascheroni constant. ¦ euler ¦ arb_const_euler
catalan ¦ ball ¦ catalan ¦ Constante de Catalan G. ¦ Catalan's constant G. ¦ catalan ¦ arb_const_catalan
khinchin ¦ ball ¦ khinchin ¦ Constante de Khinchin. ¦ Khinchin's constant. ¦ khinchin ¦ arb_const_khinchin
glaisher ¦ ball ¦ glaisher ¦ Constante de Glaisher–Kinkelin. ¦ Glaisher–Kinkelin constant. ¦ glaisher ¦ arb_const_glaisher
inf ¦ ball ¦ inf ¦ +∞ (como bola). ¦ +∞ (as a ball). ¦ inf ¦
N ¦ ball ¦ N(x), N(x, digits=d), N(x, prec=p) ¦ Aproximação numérica: converte exatos em bolas e arredonda na precisão pedida. ¦ Numerical approximation: converts exact values to balls and rounds at the requested precision. ¦ N(1/7, digits = 30) ;; N([1, 2; 3, 4]) ¦ arb_set_round acb_set_round
prec ¦ ball ¦ prec() ¦ Precisão de trabalho corrente em bits (padrão 128). Use with prec = … ou with digits = … para alterar localmente. ¦ Current working precision in bits (default 128). Use with prec = … or with digits = … to change it locally. ¦ prec() ;; with prec = 1000: prec() ¦
mid ¦ ball ¦ mid(x) ¦ Ponto médio da bola (exato). ¦ Midpoint of the ball (exact). ¦ mid(pi) ¦ arb_get_mid_arb
rad ¦ ball ¦ rad(x) ¦ Raio da bola. ¦ Radius of the ball. ¦ rad(pi) ;; with prec = 1000: rad(pi) ¦ arb_get_rad_arb
interval ¦ ball ¦ interval(a, b) ¦ Bola que contém o intervalo [a, b]. ¦ Ball containing the interval [a, b]. ¦ sin(interval(0, 1)) ¦ arb_union
contains ¦ ball ¦ contains(a, b) ¦ A bola a contém b? (Para listas: b é elemento de a?) ¦ Does ball a contain b? (For lists: is b an element of a?) ¦ contains(zeta(2) - pi^2/6, 0) ;; contains([1, 2], 2) ¦ arb_contains acb_contains
overlaps ¦ ball ¦ overlaps(a, b) ¦ As bolas se intersectam? ¦ Do the balls intersect? ¦ overlaps(exp(1), e) ¦ arb_overlaps acb_overlaps
accuracy ¦ ball ¦ accuracy(x) ¦ Bits de precisão relativa efetiva da bola. ¦ Effective relative accuracy of the ball, in bits. ¦ accuracy(sin(10^30)) ¦ arb_rel_accuracy_bits
deg ¦ poly ¦ deg(p) ¦ Grau (−1 para o polinômio zero). Também: degree. ¦ Degree (−1 for the zero polynomial). Also: degree. ¦ x = gen(ZZ[x]); deg(x^5 + 1) ¦ fmpz_poly_length
coeff ¦ poly ¦ coeff(p, k), p[k] ¦ Coeficiente de xᵏ. ¦ Coefficient of xᵏ. ¦ x = gen(ZZ[x]); coeff((x + 1)^10, 5) ¦ fmpz_poly_get_coeff_fmpz
coeffs ¦ poly ¦ coeffs(p) ¦ Lista de coeficientes do grau 0 ao grau n. ¦ List of coefficients from degree 0 to degree n. ¦ x = gen(ZZ[x]); coeffs((x + 1)^5) ¦ fmpz_poly_get_coeff_fmpz
lc ¦ poly ¦ lc(p) ¦ Coeficiente líder. ¦ Leading coefficient. ¦ x = gen(QQ[x]); lc(3x^2 + 1) ¦
diff ¦ poly ¦ diff(p), diff(p, n) ¦ Derivada (n-ésima). Também: derivative. ¦ (n-th) derivative. Also: derivative. ¦ x = gen(ZZ[x]); diff(x^5, 2) ¦ fmpz_poly_derivative fmpq_poly_derivative arb_poly_derivative fmpz_mod_poly_derivative fq_default_poly_derivative
integral ¦ poly ¦ integral(p) ¦ Primitiva com termo constante 0. ¦ Antiderivative with zero constant term. ¦ x = gen(QQ[x]); integral(x^2 + 1) ¦ fmpq_poly_integral arb_poly_integral acb_poly_integral
compose ¦ poly ¦ compose(p, q) = p(q) ¦ Composição de polinômios. ¦ Polynomial composition. ¦ x = gen(ZZ[x]); compose(x^2, x + 1) ¦ fmpz_poly_compose fmpq_poly_compose fmpz_mod_poly_compose fq_default_poly_compose
evalpoly ¦ poly ¦ evalpoly(p, x) = p(x) ¦ Avaliação; polinômios também podem ser chamados diretamente, inclusive em bolas, matrizes e outros polinômios. ¦ Evaluation; polynomials can also be called directly, including on balls, matrices and other polynomials. ¦ x = gen(QQ[x]); p = x^2 - 2; p(3/2), p(sqrt(2)) ¦ fmpz_poly_evaluate_fmpz fmpq_poly_evaluate_fmpq arb_poly_evaluate acb_poly_evaluate
content ¦ poly ¦ content(p) ¦ Conteúdo (mdc dos coeficientes). ¦ Content (gcd of the coefficients). ¦ x = gen(ZZ[x]); content(6x^2 + 4) ¦ fmpz_poly_content
primitive ¦ poly ¦ primitive(p) ¦ Parte primitiva em ℤ[x]. ¦ Primitive part in ℤ[x]. ¦ x = gen(QQ[x]); primitive(x^2/2 + x/3) ¦ fmpz_poly_primitive_part
monic ¦ poly ¦ monic(p) ¦ p dividido pelo coeficiente líder. ¦ p divided by its leading coefficient. ¦ x = gen(QQ[x]); monic(3x^2 + 1) ¦ fmpq_poly_make_monic fmpz_mod_poly_make_monic fq_default_poly_make_monic
disc ¦ poly ¦ disc(p) ¦ Discriminante. Também: discriminant. ¦ Discriminant. Also: discriminant. ¦ x = gen(ZZ[x]); disc(x^3 + x + 1) ¦ fmpz_poly_discriminant fmpq_poly_resultant
resultant ¦ poly ¦ resultant(p, q) ¦ Resultante de dois polinômios. ¦ Resultant of two polynomials. ¦ x = gen(ZZ[x]); resultant(x^2 + 1, x^2 - 2) ¦ fmpz_poly_resultant fmpq_poly_resultant
issquarefree ¦ poly ¦ issquarefree(x) ¦ Livre de quadrados (inteiros ou polinômios)? ¦ Squarefree (integers or polynomials)? ¦ issquarefree(30) ;; x = gen(ZZ[x]); issquarefree((x - 1)^2) ¦ fmpz_poly_is_squarefree fmpq_poly_is_squarefree
isirreducible ¦ poly ¦ isirreducible(p) ¦ Polinômio irredutível? ¦ Is the polynomial irreducible? ¦ x = gen(GF(2)[x]); isirreducible(x^8 + x^4 + x^3 + x + 1) ¦ fmpz_mod_poly_is_irreducible fq_default_poly_is_irreducible fmpz_poly_factor
roots ¦ poly ¦ roots(p), roots(p, prec=…) ¦ Raízes distintas: complexas certificadas (isoladas rigorosamente) para ℤ/ℚ; numéricas para ℝ/ℂ; no próprio corpo para ℤ/pℤ e GF(q). ¦ Distinct roots: certified complex roots (rigorously isolated) over ℤ/ℚ; numerical over ℝ/ℂ; in the field itself over ℤ/pℤ and GF(q). ¦ x = gen(ZZ[x]); roots(x^5 - x - 1) ;; x = gen(Zmod(13)[x]); roots(x^2 + 1) ¦ arb_fmpz_poly_complex_roots acb_poly_find_roots fmpz_mod_poly_roots fq_default_poly_roots
realroots ¦ poly ¦ realroots(p), realroots(p, prec=…) ¦ Raízes reais isoladas, em ordem crescente. ¦ Isolated real roots, in increasing order. ¦ x = gen(ZZ[x]); realroots(chebyshevt(7)) ¦ arb_fmpz_poly_complex_roots
cyclotomic ¦ poly ¦ cyclotomic(n), cyclotomic(n, var="t") ¦ Polinômio ciclotômico Φₙ. ¦ Cyclotomic polynomial Φₙ. ¦ cyclotomic(105) ¦ fmpz_poly_cyclotomic
chebyshevt ¦ poly ¦ chebyshevt(n) ¦ Polinômio de Chebyshev Tₙ. ¦ Chebyshev polynomial Tₙ. ¦ chebyshevt(8) ¦ fmpz_poly_chebyshev_t
chebyshevu ¦ poly ¦ chebyshevu(n) ¦ Polinômio de Chebyshev Uₙ. ¦ Chebyshev polynomial Uₙ. ¦ chebyshevu(5) ¦ fmpz_poly_chebyshev_u
hermiteh ¦ poly ¦ hermiteh(n) ¦ Polinômio de Hermite Hₙ (físicos). ¦ Hermite polynomial Hₙ (physicists'). ¦ hermiteh(6) ¦ fmpz_poly_hermite_h
legendrep ¦ poly ¦ legendrep(n) ¦ Polinômio de Legendre Pₙ (racional). ¦ Legendre polynomial Pₙ (rational). ¦ legendrep(5) ¦ fmpq_poly_legendre_p
swinnertondyer ¦ poly ¦ swinnertondyer(n) ¦ Polinômio de Swinnerton-Dyer (irredutível, mas fatora módulo todo primo). ¦ Swinnerton-Dyer polynomial (irreducible, but factors modulo every prime). ¦ swinnertondyer(3) ¦ fmpz_poly_swinnerton_dyer
cosminpoly ¦ poly ¦ cosminpoly(n) ¦ Polinômio mínimo de 2cos(2π/n). ¦ Minimal polynomial of 2cos(2π/n). ¦ cosminpoly(7) ¦ fmpz_poly_cos_minpoly
poly ¦ poly ¦ poly([c₀, c₁, …]), poly(cs, R) ¦ Polinômio a partir dos coeficientes (grau crescente). ¦ Polynomial from coefficients (increasing degree). ¦ poly([1, 0, 1]) ;; poly([1, 2], GF(5)[t]) ¦ fmpz_poly_set_coeff_fmpz
matrix ¦ mat ¦ [a, b; c, d], matrix(linhas), matrix(m, n, f) ¦ Matriz por literal, lista de linhas, ou função (i, j) → entrada (índices a partir de 1). ¦ Matrix from a literal, list of rows, or a function (i, j) → entry (1-based indices). ¦ [1, 2; 3, 4] ;; matrix(4, 4, (i, j) -> 1/(i + j - 1)) ¦ fmpz_mat_init fmpq_mat_init
identity ¦ mat ¦ identity(n), identity(n, R) ¦ Matriz identidade n×n sobre R (padrão ℤ). ¦ n×n identity matrix over R (default ℤ). ¦ identity(3, GF(7)) ¦
zeros ¦ mat ¦ zeros(m, n), zeros(m, n, R) ¦ Matriz nula. ¦ Zero matrix. ¦ zeros(2, 3) ¦
diagonal ¦ mat ¦ diagonal([a, b, …]) ¦ Matriz diagonal. ¦ Diagonal matrix. ¦ diagonal([1, 2, 3]) ¦
vector ¦ mat ¦ vector([…]) ¦ Matriz coluna. ¦ Column matrix. ¦ vector([1, 2, 3]) ¦
nrows ¦ mat ¦ nrows(A) ¦ Número de linhas. ¦ Number of rows. ¦ nrows([1, 2; 3, 4]) ¦
ncols ¦ mat ¦ ncols(A) ¦ Número de colunas. ¦ Number of columns. ¦ ncols([1, 2, 3;]) ¦
rows ¦ mat ¦ rows(A) ¦ Lista das linhas. ¦ List of rows. ¦ rows([1, 2; 3, 4]) ¦
cols ¦ mat ¦ cols(A) ¦ Lista das colunas. ¦ List of columns. ¦ cols([1, 2; 3, 4]) ¦
transpose ¦ mat ¦ transpose(A) ¦ Transposta. ¦ Transpose. ¦ transpose([1, 2, 3; 4, 5, 6]) ¦ fmpz_mat_transpose fmpq_mat_transpose arb_mat_transpose
det ¦ mat ¦ det(A) ¦ Determinante (exato sobre ℤ, ℚ, ℤ/nℤ; bola sobre ℝ, ℂ). ¦ Determinant (exact over ℤ, ℚ, ℤ/nℤ; ball over ℝ, ℂ). ¦ det([1, 2; 3, 4]) ;; det(matrix(8, 8, (i, j) -> 1/(i + j - 1))) ¦ fmpz_mat_det fmpq_mat_det arb_mat_det acb_mat_det fmpz_mod_mat_det
trace ¦ mat ¦ trace(A) ¦ Traço. ¦ Trace. ¦ trace([1, 2; 3, 4]) ¦ fmpz_mat_trace fmpq_mat_trace arb_mat_trace
rank ¦ mat ¦ rank(A) ¦ Posto. ¦ Rank. ¦ rank([1, 2; 2, 4]) ¦ fmpz_mat_rank fmpq_mat_rref fmpz_mod_mat_rank fq_default_mat_rank
charpoly ¦ mat ¦ charpoly(A) ¦ Polinômio característico det(x·I − A). ¦ Characteristic polynomial det(x·I − A). ¦ charpoly([2, 1; 1, 2]) ¦ fmpz_mat_charpoly fmpq_mat_charpoly arb_mat_charpoly fmpz_mod_mat_charpoly fq_default_mat_charpoly
minpoly ¦ mat ¦ minpoly(A) ¦ Polinômio mínimo. ¦ Minimal polynomial. ¦ minpoly(identity(3)) ¦ fmpz_mat_minpoly fmpq_mat_minpoly fq_default_mat_minpoly
inverse ¦ mat ¦ inverse(A), A^-1 ¦ Inversa (sobre ℤ, o resultado fica em ℚ). ¦ Inverse (over ℤ the result lives in ℚ). ¦ inverse([2, 1; 1, 1]) ;; [1, 2; 3, 4]^-1 ¦ fmpq_mat_inv arb_mat_inv acb_mat_inv fmpz_mod_mat_inv fq_default_mat_inv
solve ¦ mat ¦ solve(A, b) ¦ Resolve A·x = b (b vetor/lista ou matriz). ¦ Solves A·x = b (b a vector/list or matrix). ¦ solve([2, 1; 1, 3], [1, 2]) ¦ fmpq_mat_solve arb_mat_solve acb_mat_solve
rref ¦ mat ¦ rref(A) ¦ Forma escalonada reduzida por linhas. ¦ Reduced row echelon form. ¦ rref([1, 2, 3; 4, 5, 6]) ¦ fmpq_mat_rref fmpz_mod_mat_rref fq_default_mat_rref
nullspace ¦ mat ¦ nullspace(A) ¦ Base do núcleo à direita (vetores inteiros primitivos). Também: kernel. ¦ Basis of the right kernel (primitive integer vectors). Also: kernel. ¦ nullspace([1, 2, 3; 4, 5, 6]) ¦ fmpz_mat_nullspace
hnf ¦ mat ¦ hnf(A) ¦ Forma normal de Hermite. ¦ Hermite normal form. ¦ hnf([2, 4; 6, 8]) ¦ fmpz_mat_hnf
snf ¦ mat ¦ snf(A) ¦ Forma normal de Smith. ¦ Smith normal form. ¦ snf([2, 4, 4; -6, 6, 12; 10, -4, -16]) ¦ fmpz_mat_snf
lll ¦ mat ¦ lll(A) ¦ Redução LLL das linhas (base reduzida do reticulado). ¦ LLL reduction of the rows (reduced lattice basis). ¦ lll([1, 0, 0, 31416; 0, 1, 0, 27183; 0, 0, 1, 14142]) ¦ fmpz_lll
eigenvalues ¦ mat ¦ eigenvalues(A) ¦ Autovalores como bolas complexas (certificados quando simples). Também: eig. ¦ Eigenvalues as complex balls (certified when simple). Also: eig. ¦ eigenvalues([2, 1; 1, 3]) ¦ acb_mat_approx_eig_qr acb_mat_eig_simple acb_mat_eig_multiple
expm ¦ mat ¦ expm(A) ¦ Exponencial de matriz. ¦ Matrix exponential. ¦ expm([0, 1; -1, 0]) ¦ arb_mat_exp acb_mat_exp
dot ¦ mat ¦ dot(u, v) ¦ Produto escalar de listas. ¦ Dot product of lists. ¦ dot([1, 2, 3], [4, 5, 6]) ¦
norm ¦ mat ¦ norm(x) ¦ Norma euclidiana (lista), norma absoluta (GF(q)), ou z·z̄. ¦ Euclidean norm (list), absolute norm (GF(q)), or z·z̄. ¦ norm([3, 4]) ;; norm(gen(GF(5^3))) ¦ fq_default_norm
order ¦ ff ¦ order(F), order(a) ¦ Número de elementos de um corpo/anel finito, ou ordem multiplicativa de um elemento. ¦ Number of elements of a finite field/ring, or multiplicative order of an element. ¦ order(GF(3^5)) ;; order(Zmod(101)(2)) ¦ fq_default_ctx_order fmpz_factor fq_default_pow
modulus ¦ ff ¦ modulus(R) ¦ n de ℤ/nℤ ou polinômio de definição de GF(q). ¦ n of ℤ/nℤ or the defining polynomial of GF(q). ¦ modulus(GF(2^8)) ¦ fq_default_ctx_modulus
frobenius ¦ ff ¦ frobenius(a), frobenius(a, e) ¦ Automorfismo de Frobenius a ↦ a^(pᵉ). ¦ Frobenius automorphism a ↦ a^(pᵉ). ¦ F = GF(7^3); a = gen(F); frobenius(a) == a^7 ¦ fq_default_frobenius
fqtrace ¦ ff ¦ fqtrace(a) ¦ Traço absoluto de a ∈ GF(pᵏ) sobre GF(p). ¦ Absolute trace of a ∈ GF(pᵏ) over GF(p). ¦ fqtrace(gen(GF(2^8))) ¦ fq_default_trace
isgenerator ¦ ff ¦ isgenerator(a) ¦ a gera o grupo multiplicativo de GF(q)? ¦ Does a generate the multiplicative group of GF(q)? ¦ isgenerator(gen(GF(2^8))) ¦ fq_default_pow fmpz_factor
elements ¦ ff ¦ elements(R) ¦ Lista de todos os elementos de ℤ/nℤ ou GF(q) (até 10⁶). ¦ List of all elements of ℤ/nℤ or GF(q) (up to 10⁶). ¦ elements(GF(4)) ¦ fq_default_set_fmpz_poly
len ¦ list ¦ len(xs) ¦ Tamanho de lista, tupla ou string (para polinômios: número de coeficientes). Também: length. ¦ Length of a list, tuple or string (for polynomials: number of coefficients). Also: length. ¦ len(1..10) ¦
map ¦ list ¦ map(xs, f) ¦ [f(x) | x <- xs]. ¦ [f(x) | x <- xs]. ¦ map(1..5, k -> k!) ;; (1..5).map(fib) ¦
filter ¦ list ¦ filter(xs, p) ¦ Elementos que satisfazem p. ¦ Elements satisfying p. ¦ filter(1..100, isprime) ¦
reduce ¦ list ¦ reduce(xs, f), reduce(xs, f, init) ¦ Dobra à esquerda. Também: fold. ¦ Left fold. Also: fold. ¦ reduce(1..10, (a, b) -> a * b) ¦
scan ¦ list ¦ scan(xs, f), scan(xs, f, init) ¦ Acumulações parciais. ¦ Partial accumulations. ¦ scan(1..10, (a, b) -> a + b) ¦
sum ¦ list ¦ sum(xs), sum(xs, f) ¦ Soma. Também: Σ. ¦ Sum. Also: Σ. ¦ sum(1..100) ;; sum(1..20, k -> 1/k^2) ¦
prod ¦ list ¦ prod(xs), prod(xs, f) ¦ Produto. Também: Π. ¦ Product. Also: Π. ¦ prod(primes(30)) ¦
range ¦ list ¦ a..b, a..b by s, range(n), range(a, b, s) ¦ Intervalo inclusivo de números. ¦ Inclusive range of numbers. ¦ 1..10 by 3 ;; 0..1 by 1/4 ¦
first ¦ list ¦ first(xs) ¦ Primeiro elemento. Também: head. ¦ First element. Also: head. ¦ first(primes(100)) ¦
last ¦ list ¦ last(xs) ¦ Último elemento. ¦ Last element. ¦ last(primes(100)) ¦
tail ¦ list ¦ tail(xs) ¦ Todos menos o primeiro. ¦ All but the first. ¦ tail([1, 2, 3]) ¦
take ¦ list ¦ take(xs, n) ¦ Primeiros n elementos. ¦ First n elements. ¦ take(primes(1000), 5) ¦
drop ¦ list ¦ drop(xs, n) ¦ Remove os primeiros n elementos. ¦ Drops the first n elements. ¦ drop(1..10, 7) ¦
reverse ¦ list ¦ reverse(xs) ¦ Ordem inversa (listas e strings). ¦ Reversed order (lists and strings). ¦ reverse("abc") ¦
sort ¦ list ¦ sort(xs), sort(xs, key) ¦ Ordenação (opcionalmente por chave). ¦ Sorting (optionally by key). ¦ sort([3, 1, 2]) ;; sort(1..10, k -> -k) ¦
min ¦ list ¦ min(xs), min(a, b, …) ¦ Mínimo. ¦ Minimum. ¦ min(3, 1/2, pi) ¦
max ¦ list ¦ max(xs), max(a, b, …) ¦ Máximo. ¦ Maximum. ¦ max(map(1..20, numdivisors)) ¦
zip ¦ list ¦ zip(xs, ys, …) ¦ Lista de tuplas. ¦ List of tuples. ¦ zip(1..3, ["a", "b", "c"]) ¦
enumerate ¦ list ¦ enumerate(xs) ¦ Pares (índice, elemento), índices a partir de 1. ¦ (index, element) pairs, 1-based. ¦ enumerate(["a", "b"]) ¦
concat ¦ list ¦ concat(xs, ys, …) ¦ Concatenação (também xs + ys). ¦ Concatenation (also xs + ys). ¦ concat([1], [2, 3]) ¦
flatten ¦ list ¦ flatten(xs) ¦ Achata listas aninhadas. ¦ Flattens nested lists. ¦ flatten([[1, [2]], [3]]) ¦
unique ¦ list ¦ unique(xs) ¦ Remove repetidos (mantém a ordem). ¦ Removes duplicates (keeps order). ¦ unique(map(1..20, k -> k % 4)) ¦
count ¦ list ¦ count(xs, p) ¦ Quantos elementos satisfazem p (ou são iguais a p). ¦ How many elements satisfy p (or equal p). ¦ count(1..1000, isprime) ¦
all ¦ list ¦ all(xs, p) ¦ Todos satisfazem p? ¦ Do all satisfy p? ¦ all(primes(100), isodd) ¦
any ¦ list ¦ any(xs, p) ¦ Algum satisfaz p? ¦ Does any satisfy p? ¦ any(1..10, issquare) ¦
find ¦ list ¦ find(xs, p) ¦ Primeiro elemento que satisfaz p, ou (). ¦ First element satisfying p, or (). ¦ find(1..100, k -> k^2 > 500) ¦
indexof ¦ list ¦ indexof(xs, v) ¦ Posição de v (a partir de 1), ou 0. ¦ Position of v (1-based), or 0. ¦ indexof(primes(50), 13) ¦
iterate ¦ list ¦ iterate(f, x, n) ¦ [x, f(x), f(f(x)), …] com n aplicações. ¦ [x, f(x), f(f(x)), …] with n applications. ¦ iterate(x -> x^2 + 1, 0, 5) ¦
nest ¦ list ¦ nest(f, x, n) ¦ f aplicada n vezes. ¦ f applied n times. ¦ nest(x -> 1 + 1/x, 1, 20) ¦
fixedpoint ¦ list ¦ fixedpoint(f, x) ¦ Itera f até o valor se repetir. ¦ Iterates f until the value repeats. ¦ fixedpoint(n -> sum(digits(n)), 2^100) ¦
while ¦ list ¦ while(cond, f, x) ¦ Aplica f enquanto cond(x) for verdadeiro. ¦ Applies f while cond(x) is true. ¦ while(n -> n > 1, n -> if iseven(n) then n // 2 else 3n + 1, 27) ¦
table ¦ list ¦ table(f, xs, ys, …) ¦ Tabela aninhada de f(x, y, …). ¦ Nested table of f(x, y, …). ¦ table((a, b) -> gcd(a, b), 1..5, 1..5) ¦
tuple ¦ list ¦ tuple(a, b, …), (a, b) ¦ Tupla. ¦ Tuple. ¦ tuple(1, 2) ¦
list ¦ list ¦ list(x) ¦ Converte tupla ou string em lista. ¦ Converts a tuple or string to a list. ¦ list("abc") ¦
apply ¦ list ¦ apply(f, xs) ¦ Chama f com os elementos de xs como argumentos. ¦ Calls f with the elements of xs as arguments. ¦ apply(gcd, [12, 18]) ¦
id ¦ list ¦ id(x) ¦ Identidade. ¦ Identity. ¦ map([1, 2], id) ¦
plot ¦ plot ¦ plot(f, a, b), plot([f, g], a, b, points=, xlim=, ylim=, title=, atributos) ¦ Gráfico de funções reais amostradas em [a, b]. xlim = [x₀, x₁] e ylim = [y₀, y₁] fixam a janela visível (sem eles, y é escolhido automaticamente ignorando polos). Aceita atributos de desenho (color, width, dash…) e pode ser somado a primitivas com +. ¦ Plot of real functions sampled on [a, b]. xlim = [x₀, x₁] and ylim = [y₀, y₁] fix the visible window (without them, y is chosen automatically, ignoring poles). Accepts drawing attributes (color, width, dash…) and can be added to primitives with +. ¦ plot(t -> sin(t)/t, -20, 20) ;; plot([sin, cos], 0, 2pi) ;; plot(tan, -5, 5, ylim = [-4, 4]) ;; plot(sin, 0, 2pi, color = "red", dash = "dash") + point((pi, 0)) ¦
listplot ¦ plot ¦ listplot(ys), listplot([(x, y), …], joined=true, xlim=, ylim=, atributos) ¦ Gráfico de pontos; xlim e ylim fixam a janela visível. Aceita atributos de desenho (color, marker, size…). ¦ Point plot; xlim and ylim fix the visible window. Accepts drawing attributes (color, marker, size…). ¦ listplot(map(1..50, k -> numdivisors(k))) ;; listplot(map(1..100, eulerphi), xlim = [0, 50], ylim = [0, 50]) ¦
complexplot ¦ plot ¦ complexplot(zs), complexplot(zs, xlim=, ylim=, atributos) ¦ Pontos no plano complexo, com escala igual nos eixos. xlim (parte real) e ylim (parte imaginária) fixam a região; se as proporções não baterem com o quadro, o outro eixo é ampliado para manter a escala. ¦ Points in the complex plane, with equal axis scales. xlim (real part) and ylim (imaginary part) fix the region; if the proportions do not match the frame, the other axis is widened to keep the scale. ¦ x = gen(ZZ[x]); complexplot(roots(x^30 - x - 1)) ;; x = gen(ZZ[x]); complexplot(roots(x^60 - x - 1), xlim = [-1.5, 1.5], ylim = [-1.5, 1.5]) ¦
point ¦ draw ¦ point(p, atributos) ¦ Um ponto. Pontos são números complexos (2 + i), reais (3) ou tuplas (x, y); bolas viram seu ponto médio. Atributos: color, size (raio em px), marker ("dot", "circle", "square", "diamond", "cross", "plus"), opacity, label. ¦ A point. Points are complex numbers (2 + i), reals (3) or tuples (x, y); balls become their midpoint. Attributes: color, size (radius in px), marker ("dot", "circle", "square", "diamond", "cross", "plus"), opacity, label. ¦ point(1 + i) ;; point((2, 3), size = 5, color = "red") ¦
points ¦ draw ¦ points(ps, atributos) ¦ Vários pontos com o mesmo estilo (desenhados de uma vez, eficiente para milhares de pontos). ¦ Many points with the same style (drawn at once, efficient for thousands of points). ¦ points([exp(2pi*i*k/12) | k <- 1..12], marker = "square") ¦
segment ¦ draw ¦ segment(a, b, atributos) ¦ Segmento de a até b. Atributos de traço: color, width (px), dash ("dot", "dash", "dashdot" ou "4 2"), opacity. ¦ Segment from a to b. Stroke attributes: color, width (px), dash ("dot", "dash", "dashdot" or "4 2"), opacity. ¦ segment(0, 1 + i) ;; segment((0, 0), (1, 2), width = 3, dash = "dash") ¦
arrow ¦ draw ¦ arrow(a, b, atributos) ¦ Seta de a para b (o tamanho da ponta acompanha width). ¦ Arrow from a to b (the head size follows width). ¦ arrow(0, 1 + i) ;; [arrow(0, exp(i*k*pi/4), color = k) | k <- 1..6] ¦
line ¦ draw ¦ line([p₁, p₂, …], closed=false, atributos) ¦ Poligonal pelos pontos dados; closed = true fecha o caminho. ¦ Polyline through the given points; closed = true closes the path. ¦ line([0, 1, 1 + i, 2i]) ;; line([(k, k^2) | k <- -3..3]) ¦
polygon ¦ draw ¦ polygon([p₁, p₂, …], atributos) ¦ Polígono fechado. fill = true preenche com a cor do traço; fill = "cor" usa outra cor; opacity torna translúcido. ¦ Closed polygon. fill = true fills with the stroke color; fill = "color" uses another color; opacity makes it translucent. ¦ polygon([0, 1, i]) ;; polygon([exp(2pi*i*k/5) | k <- 1..5], fill = "gold", color = "ink") ¦
rect ¦ draw ¦ rect(a, b, atributos) ¦ Retângulo de lados paralelos aos eixos com cantos opostos a e b. ¦ Axis-parallel rectangle with opposite corners a and b. ¦ rect(0, 2 + i, fill = true, opacity = 0.3) ¦
infline ¦ draw ¦ infline(a, b, atributos) ¦ Reta infinita por a e b, cortada nas bordas da janela. ¦ Infinite line through a and b, clipped at the window edges. ¦ infline(0, 1 + i) + circle(0, 1) ¦
ray ¦ draw ¦ ray(a, b, atributos) ¦ Semirreta que parte de a e passa por b. ¦ Ray starting at a through b. ¦ ray(0, 1 + i) + point(0) ¦
circle ¦ draw ¦ circle(c, r, atributos) ¦ Circunferência de centro c e raio r (em unidades do plano). Com escala igual nos eixos (padrão de draw) é um círculo; com aspect = "auto", uma elipse. ¦ Circle with center c and radius r (in plane units). With equal axis scales (the draw default) it is round; with aspect = "auto", an ellipse. ¦ circle(0, 1) ;; [circle(0, r) | r <- 1..5] ;; circle(1 + i, 1/2, color = "red", dash = "dot") ¦
disk ¦ draw ¦ disk(c, r, atributos) ¦ Disco (círculo preenchido); fill = "cor" escolhe o preenchimento. ¦ Disk (filled circle); fill = "color" chooses the fill. ¦ disk(0, 1, opacity = 0.3) + circle(0, 1) ¦
arc ¦ draw ¦ arc(c, r, θ₀, θ₁, atributos) ¦ Arco de circunferência de θ₀ a θ₁ (radianos, sentido anti-horário). ¦ Circular arc from θ₀ to θ₁ (radians, counterclockwise). ¦ arc(0, 1, 0, pi) ;; arc(0, 1, 0, 3pi/2, width = 3) ¦
sector ¦ draw ¦ sector(c, r, θ₀, θ₁, atributos) ¦ Setor circular ("fatia") de θ₀ a θ₁, preenchido. ¦ Circular sector ("slice") from θ₀ to θ₁, filled. ¦ sector(0, 1, 0, pi/3, color = 2) + sector(0, 1, pi/3, 2pi, color = 3, opacity = 0.4) ¦
curve ¦ draw ¦ curve(t -> z(t), a, b, points=400, atributos) ¦ Curva paramétrica: z(t) devolve um complexo ou uma tupla (x, y). Pontos onde a função falha abrem lacunas. ¦ Parametric curve: z(t) returns a complex number or a tuple (x, y). Points where the function fails leave gaps. ¦ curve(t -> exp(i*t) + exp(7i*t)/2, 0, 2pi) ;; curve(t -> (sin(3t), sin(4t)), 0, 2pi, color = 4) ¦
text ¦ draw ¦ text(s, p, pos="c", fontsize=13, color=) ¦ Texto no ponto p. pos indica onde o texto fica em relação ao ponto: "c", "n", "s", "e", "w", "ne", "nw", "se", "sw". Valores que não são strings são exibidos como texto. ¦ Text at point p. pos says where the text sits relative to the point: "c", "n", "s", "e", "w", "ne", "nw", "se", "sw". Non-string values are shown as text. ¦ point(1 + i) + text("1 + i", 1 + i, pos = "ne") ;; text(pi, 0, fontsize = 20) ¦
group ¦ draw ¦ group(g₁, g₂, …, atributos) ¦ Agrupa gráficos; os atributos do grupo valem para as primitivas que não os definem (o filho prevalece). ¦ Groups graphics; the group's attributes apply to primitives that do not set them (the child wins). ¦ group(circle(0, 1), segment(-1, 1), color = "red", width = 2) ¦
style ¦ draw ¦ style(g, atributos) ¦ Impõe atributos a todas as primitivas de g, sobrescrevendo os que elas já tinham. Útil com |>. ¦ Imposes attributes on every primitive of g, overriding those they already had. Handy with |>. ¦ [segment(0, exp(i*k*pi/6)) | k <- 1..12] |> style(color = "gray", width = 0.5) ¦
draw ¦ draw ¦ draw(g, xlim=, ylim=, aspect="equal", axes=true, grid=true, frame=true, title=, width=, height=) ¦ Ajusta a janela de um gráfico (ou lista de gráficos). Sem draw, uma célula cujo valor é um gráfico ou uma lista só de gráficos já é desenhada. aspect = "equal" mantém a mesma escala nos eixos (padrão para primitivas; plot usa "auto"). width e height em px. ¦ Sets the window of a graphic (or list of graphics). Without draw, a cell whose value is a graphic or a list of graphics only is drawn anyway. aspect = "equal" keeps the same scale on both axes (the default for primitives; plot uses "auto"). width and height in px. ¦ draw([circle(0, 1), segment(-1, 1)], axes = false, grid = false) ;; draw(circle(0, 1), xlim = [0, 2], ylim = [0, 2]) ¦
translate ¦ draw ¦ translate(g, v) ¦ Desloca g pelo vetor v (complexo ou tupla). Como todas as transformações, aceita um gráfico ou lista de gráficos e combina com |>. ¦ Translates g by the vector v (complex or tuple). Like every transformation, it takes a graphic or list of graphics and combines with |>. ¦ translate(circle(0, 1), 2 + i) ;; [translate(circle(0, 1/2), k) | k <- 1..5] ¦
rotate ¦ draw ¦ rotate(g, θ, c=0) ¦ Gira g de θ radianos (anti-horário) em torno de c. Círculos e arcos continuam exatos; o texto muda de lugar mas não gira. ¦ Rotates g by θ radians (counterclockwise) about c. Circles and arcs stay exact; text moves but is not rotated. ¦ [rotate(segment(0, 1), k*pi/8) | k <- 1..16] ;; rotate(rect(0, 2 + i), pi/6, 1 + i/2) + rect(0, 2 + i) ¦
scale ¦ draw ¦ scale(g, k, c=0), scale(g, (kx, ky), c=0) ¦ Homotetia de razão k com centro c; com (kx, ky), escala cada eixo (círculos viram elipses, desenhadas como poligonais). ¦ Homothety with ratio k about c; with (kx, ky), scales each axis (circles become ellipses, drawn as polylines). ¦ [scale(polygon([1, i, -1, -i]), 0.8^k) | k <- 0..10] ;; scale(circle(0, 1), (2, 1)) ¦
reflect ¦ draw ¦ reflect(g, a, b) ¦ Reflexão na reta que passa por a e b. ¦ Reflection in the line through a and b. ¦ g = polygon([1, 2, 2 + i]); g + reflect(g, 0, i) ;; arc(0, 1, 0, pi/2) + reflect(arc(0, 1, 0, pi/2), 0, 1 + i) ¦
transform ¦ draw ¦ transform(g, z -> f(z), steps=), transform(g, A) ¦ Imagem de g por uma função complexa: segmentos são subdivididos e círculos e arcos amostrados antes de mapear cada ponto (steps fixa a subdivisão por segmento; pontos onde f falha abrem lacunas). Com uma matriz 2×2 A, aplica a transformação linear exata. Retas infinitas não são aceitas: use segment. ¦ Image of g under a complex function: segments are subdivided and circles and arcs sampled before each point is mapped (steps fixes the subdivision per segment; points where f fails leave gaps). With a 2×2 matrix A, applies the exact linear map. Infinite lines are not accepted: use segment. ¦ transform([segment(k/4 - i, k/4 + i) | k <- -4..4], z -> z^2) ;; transform([circle(0, r) | r <- 1..4] + [segment(0, 4*exp(i*k*pi/6)) | k <- 1..12], z -> (z - 1)/(z + 1)) ;; transform(circle(0, 1), [2, 1; 0, 1]) ¦
rgb ¦ draw ¦ rgb(r, g, b) ¦ Cor a partir de componentes em [0, 1], para usar em color e fill. Cores também podem ser nomes ("red", "steelblue"…), "#rrggbb", "ink" (cor do texto) ou índices 1 a 6 da paleta (que acompanham o tema claro/escuro). ¦ Color from components in [0, 1], for use in color and fill. Colors can also be names ("red", "steelblue"…), "#rrggbb", "ink" (text color) or palette indices 1 to 6 (which follow the light/dark theme). ¦ disk(0, 1, color = rgb(1, 0.5, 0)) ¦
hsl ¦ draw ¦ hsl(h, s, l) ¦ Cor por matiz h (em voltas: 0 e 1 são vermelho), saturação s e luminosidade l em [0, 1]. Prático para colorir por fase: hsl(arg(z)/(2pi), 1, 0.5). ¦ Color by hue h (in turns: 0 and 1 are red), saturation s and lightness l in [0, 1]. Handy for coloring by phase: hsl(arg(z)/(2pi), 1, 0.5). ¦ [disk(exp(2pi*i*k/12), 0.2, color = hsl(k/12, 0.8, 0.5)) | k <- 1..12] ¦
slider ¦ plot ¦ slider(a, b), slider(a, b, passo, value=, label=) ¦ Controle deslizante: a célula passa a valer o número escolhido. ¦ Slider: the cell's value becomes the chosen number. ¦ k = slider(1, 20) ¦
checkbox ¦ plot ¦ checkbox(value=false, label=) ¦ Caixa de seleção (valor booleano). ¦ Checkbox (boolean value). ¦ show = checkbox() ¦
textinput ¦ plot ¦ textinput(value="") ¦ Campo de texto (valor string). ¦ Text field (string value). ¦ name = textinput(value = "Cauchy") ¦
numinput ¦ plot ¦ numinput(value=0) ¦ Campo numérico: inteiro, racional (a/b) ou real. ¦ Numeric field: integer, rational (a/b) or real. ¦ n = numinput(value = 2^61 - 1) ¦
select ¦ plot ¦ select([op₁, op₂, …]) ¦ Lista de opções; o valor é o item escolhido. ¦ Dropdown; the value is the chosen item. ¦ f = select([sin, cos, tan]) ¦
str ¦ misc ¦ str(x) ¦ Representação textual. ¦ Textual representation. ¦ "n = " + str(10!) ¦
type ¦ misc ¦ type(x) ¦ Nome do tipo/anel de x. ¦ Name of the type/ring of x. ¦ type(1/2) ;; type([1]) ¦
error ¦ misc ¦ error(msg) ¦ Interrompe a avaliação com uma mensagem. ¦ Stops evaluation with a message. ¦ f(n) = if n < 0 then error("n < 0") else n ¦
assert ¦ misc ¦ assert(cond), assert(cond, msg) ¦ Erro se a condição for falsa. ¦ Error if the condition is false. ¦ assert(isprime(97)) ¦
time ¦ misc ¦ time(() -> expr) ¦ Par (valor, segundos). ¦ Pair (value, seconds). ¦ time(() -> partitions(10^7)) ¦
flint ¦ misc ¦ flint("nome", args…) ¦ Chama diretamente uma função da FLINT exposta pela ponte (veja a aba FLINT). Argumentos são convertidos para os tipos C; prec e contexto do anel são automáticos. ¦ Directly calls a FLINT function exposed by the bridge (see the FLINT tab). Arguments are converted to the C types; prec and ring context are automatic. ¦ flint("arb_gamma", 1/3) ;; flint("fmpz_mat_det", [1, 2; 3, 4]) ;; F = GF(5^2); flint("fq_gen", F) ¦
`;

export const ALIASES = {
  ln: 'log', 'φ': 'eulerphi', 'μ': 'moebius', 'Γ': 'gamma', 'ψ': 'digamma', 'ζ': 'zeta',
  degree: 'deg', derivative: 'diff', discriminant: 'disc', kernel: 'nullspace', eig: 'eigenvalues',
  length: 'len', fold: 'reduce', 'Σ': 'sum', 'Π': 'prod', head: 'first', 'π': 'pi', 'γ': 'euler',
  'ℤ': 'ZZ', 'ℚ': 'QQ', 'ℝ': 'RR', 'ℂ': 'CC',
};

export const REF = new Map();
for (const line of RAW.split('\n')) {
  if (!line.trim()) continue;
  const [name, cat, sig, pt, en, ex, fl] = line.split(/\s*¦\s*/);
  REF.set(name, {
    name, cat, sig, pt, en,
    examples: ex ? ex.split(' ;; ').map((s) => s.trim()) : [],
    flint: fl ? fl.split(/\s+/) : [],
  });
}

// Módulo da documentação da FLINT a partir do nome da função C.
const MODULES = [
  'arb_fmpz_poly', 'arb_hypgeom', 'acb_hypgeom', 'acb_modular', 'acb_elliptic', 'acb_dirichlet', 'acb_poly',
  'arb_poly', 'acb_mat', 'arb_mat', 'acb', 'arb', 'arf', 'mag', 'fmpz_mod_poly_factor', 'fmpz_mod_poly',
  'fmpz_mod_mat', 'fmpz_mod', 'fmpz_poly_factor', 'fmpz_poly', 'fmpz_mat', 'fmpz_lll', 'fmpz_factor',
  'fmpq_poly', 'fmpq_mat', 'fmpq', 'fmpz', 'fq_default_poly_factor', 'fq_default_poly', 'fq_default_mat',
  'fq_default', 'arith', 'partitions', 'bernoulli',
];

export function flintDocUrl(fn) {
  if (fn.startsWith('n_')) return `https://flintlib.org/doc/ulong_extras.html#c.${fn}`;
  let mod = MODULES.find((m) => fn.startsWith(m + '_'));
  if (fn === 'fmpz_lll') mod = 'fmpz_lll';
  if (!mod) return null;
  return `https://flintlib.org/doc/${mod}.html#c.${fn}`;
}
