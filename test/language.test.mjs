import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { init, evalOne } from './harness.mjs';
import { parse } from '../src/js/lang/parser.js';

before(init);

const PI_50 = '3.14159265358979323846264338327950288419716939937510';

const cases = [
  // símbolos Unicode equivalentes a ->, <-, => e |>
  ['[k^2 | k ← 1..4] ▷ map(t → t + 1)', '[2, 5, 10, 17]'],
  ['match 3 { 3 ⇒ "três"; _ ⇒ "outro" }', 'três'],
  ['[k | k ← 1..9, k ≥ 3, k ≤ 6, k ≠ 4]', '[3, 5, 6]'],
  // inteiros e racionais
  ['2^128 + 1', '340282366920938463463374607431768211457'],
  ['factor(2^128 + 1)', '59649589127497217 * 5704689200685129054721'],
  ['factor(-360)', '-1 * 2^3 * 3^2 * 5'],
  ['factor(12/35)', '2^2 * 3 * 5^-1 * 7^-1'],
  ['1/3 + 1/6', '1/2'],
  ['7 // 2, 7 % 2, -7 // 2, -7 % 2', '(3, 1, -4, 1)'],
  ['gcd(12, 18), lcm(4, 6)', '(6, 12)'],
  ['xgcd(240, 46)', '(2, -9, 47)'],
  ['powmod(3, 200, 1000)', '1'],
  ['crt([2, 3, 2], [3, 5, 7]), crt([3, 5], [4, 6], full = true), crt([7, 7], [12, 18], full = true)', '(23, (11, 12), (7, 36))'],
  ['crt([-1, -1], [10, 21], sign = true), crt([], [], full = true), crt([5], [3])', '(-1, (0, 1), 2)'],
  ['crt(Zmod(3)(2), Zmod(5)(3)), ring(crt([Zmod(4)(1), Zmod(6)(3)]))', '(8, Zmod(12))'],
  ['kronecker(5, 12), kronecker(-1, 7), ratrecon(Zmod(10007)(2)/3)', '(-1, -1, 2/3)'],
  ['rationalize(0.829 + 0*i), rationalize(RR(1/3)), rationalize(pi, 1/1000), rationalize(-RR(7/3)), with digits = 5: rationalize(pi)', '(829/1000, 1/3, 333/106, -7/3, 355/113)'],
  ['contfrac(415/93), contfrac(sqrt(2), 6), fromcontfrac([4, 2, 6, 7])', '([4, 2, 6, 7], [1, 2, 2, 2, 2, 2], 415/93)'],
  ['convergents(pi, 5), with digits = 60: len(contfrac(pi)) > 50', '([3, 22/7, 333/106, 355/113, 103993/33102], true)'],
  ['perfectpower(2^60), perfectpower(-27), perfectpower(12), isperfectpower(1000), isperfectpower(10)', '((2, 60), (-3, 3), (12, 1), true, false)'],
  ['primitiveroot(7), primitiveroot(2^61 - 1), primitiveroot(Zmod(23)), primitiveroot(2)', '(3, 37, 5, 1)'],
  ['dlog(13, 3, 17), dlog(Zmod(11)(4), Zmod(11)(2)), dlog(2, 4, 7)', '(4, 2, 2)'],
  ['p = 2^61 - 1; g = primitiveroot(p); powmod(g, dlog(123456789, g, p), p)', '123456789'],
  ['ps = primes(2, 500); x = 2^500 + 12345; crt([x % p | p <- ps], ps) == x, crt([-x % p | p <- ps], ps, sign = true) == -x', '(true, true)'],
  ['binomial(10, 3), binomial(-3, 2)', '(120, 6)'],
  ['fib(100)', '354224848179261915075'],
  ['eulerphi(36), moebius(30), sigma(12)', '(12, -1, 28)'],
  ['divisors(28)', '[1, 2, 4, 7, 14, 28]'],
  ['partitions(100)', '190569292'],
  ['bernoulli(12)', '-691/2730'],
  ['isprime(2^127 - 1), isprime(2^128 + 1)', '(true, false)'],
  ['prime(1000), primepi(1000)', '(7919, 168)'],
  ['nextprime(10^20)', '100000000000000000039'],
  ['isqrt(10^21), iroot(10^21, 3)', '(31622776601, 10000000)'],
  ['digits(1234)', '[4, 3, 2, 1]'],
  ['2^-3', '1/8'],
  ['(2/3)^3', '8/27'],
  // reais e complexos
  [`with digits = 50: pi`, (s) => s.startsWith('3.141592653589793238462643383279502884197169399375')],
  ['sqrt(16), sqrt(9/4)', '(4, 3/2)'],
  ['sqrt(-4)', '2·i'],
  ['i^2', '-1'],
  ['contains(zeta(2) - pi^2/6, 0)', 'true'],
  ['contains(gamma(1/2)^2 - pi, 0)', 'true'],
  ['contains(exp(i*pi) + 1, 0)', 'true'],
  ['1.5 + 1', '2.5'],
  ['floor(pi), ceil(pi), round(7/2)', '(3, 4, 4)'],
  ['abs(-3/4), abs(3 + 4i)', '(3/4, 5)'],
  ['N(1/3, digits = 10)', (s) => s.startsWith('0.333333333')],
  ['exp(1) == e', (s) => s.startsWith('ERRO: comparação indecidível')],
  ['pi > 3', 'true'],
  ['1 < 2 <= 2 < 3', 'true'],
  // polinômios
  ['x = gen(QQ[x]); (x + 1)^3', 'x^3 + 3*x^2 + 3*x + 1'],
  ['x = gen(ZZ[x]); factor(x^4 - 1)', '(x + 1) * (x - 1) * (x^2 + 1)'],
  ['x = gen(ZZ[x]); factor(2x^2 - 2)', '2 * (x - 1) * (x + 1)'],
  ['x = gen(ZZ[x]); (x^2 - 1) / (x - 1)', 'x + 1'],
  ['x = gen(ZZ[x]); (x^2 - 1) / 2', '1/2*x^2 - 1/2'],
  ['x = gen(QQ[x]); divrem(x^3 + 1, x - 2)', '(x^2 + 2*x + 4, 9)'],
  ['x = gen(QQ[x]); p = x^2 - 2; p(3), p(1/2)', '(7, -7/4)'],
  ['x = gen(QQ[x]); gcd(x^2 - 1, x^2 + 2x + 1)', 'x + 1'],
  ['x = gen(ZZ[x]); diff(x^3 + x)', '3*x^2 + 1'],
  ['x = gen(ZZ[x]); integral(x^2)', '1/3*x^3'],
  ['x = gen(ZZ[x]); deg(x^5 + 1), coeffs(x^2 + 2)', '(5, [2, 0, 1])'],
  ['x = gen(ZZ[x]); disc(x^2 + x + 1), resultant(x^2 + 1, x - 1)', '(-3, 2)'],
  ['x = gen(ZZ[x]); len(roots(x^5 - x - 1))', '5'],
  ['x = gen(ZZ[x]); realroots(x^3 - 2)', (s) => s.startsWith('[1.2599210498948731647672106072782283505')],
  ['cyclotomic(12)', 'x^4 - x^2 + 1'],
  ['chebyshevt(4)', '8*x^4 - 8*x^2 + 1'],
  ['x = gen(QQ[x]); p = x^2 + 1; q = x - 1; p(q)', 'x^2 - 2*x + 2'],
  // corpos finitos e Z/nZ
  ['F = GF(7^3); a = gen(F); a^100', '2*a^2 + a + 4'],
  ['F = GF(7^3); order(gen(F)), order(F)', '(342, 343)'],
  ['F = GF(2^8); a = gen(F); a^255', '1'],
  ['Zmod(12)(5) * 7', '11'],
  ['R = Zmod(7); R(3) / R(5)', '2'],
  ['R = Zmod(7); R(3)^-1', '5'],
  ['R = Zmod(12); R(4)^-1', (s) => s.startsWith('ERRO')],
  ['x = gen(GF(5)[x]); len(factor(x^5 - x))', '5'],
  ['x = gen(Zmod(7)[x]); roots(x^2 + 1)', '[]'],
  ['x = gen(Zmod(13)[x]); sort(roots(x^2 + 1))', '[5, 8]'],
  ['F = GF(9); y = gen(F[y]); len(roots(y^9 - y))', '9'],
  // integração com erro garantido
  ['with digits = 30: [contains(integrate(t -> exp(-t^2), -10, 10) - sqrt(pi), 0), contains(integrate(t -> 1/(1 + t^2), 0, 1) - pi/4, 0)]', '[true, true]'],
  ['with digits = 20: [contains(integrate(t -> sqrt(1 - t^2), -1, 1) - pi/2, 0), contains(integrate(t -> 1/t, [1, i, -1, -i, 1]) - 2*pi*i, 0)]', '[true, true]'],
  ['[contains(integrate(t -> abs(t), -1, 2) - 5/2, 0), contains(integrate(t -> floor(t)*t, 0, 3) - 13/2, 0), contains(integrate(t -> if t < 0 then -t^2 else t^3, -1, 2) - 11/3, 0)]', '[true, true, true]'],
  ['[contains(integrate(t -> max(t, 0), -1, 1) - 1/2, 0), contains(integrate(t -> integrate(s -> s*t, 0, 1), 0, 1) - 1/4, 0)]', '[true, true]'],
  ['x = gen(QQ[x]); ring(integrate(x^3 - x, 0, 2)), ring(integrate(t -> exp(i*t), 0, pi))', '(RR, CC)'],
  // funções especiais (identidades conhecidas)
  ['with digits = 20: [contains(polygamma(1, 1) - pi^2/6, 0), contains(hyp1f1(1, 2, 1) - (e - 1), 0), contains(hyp0f1(1, -1/4) - besselj(0, 1), 0)]', '[true, true, true]'],
  ['with digits = 20: [contains(ellipf(pi/2, 1/2) - ellipk(1/2), 0), contains(ellipe(pi/2, 1/2) - ellipe(1/2), 0), contains(carlsonrg(0, 1, 1) - pi/4, 0)]', '[true, true, true]'],
  ['with digits = 20: [contains(coulombf(0, 0, 1) - sin(1), 0), contains(coulombg(0, 0, 1) - cos(1), 0), contains(stieltjes(0) - euler, 0)]', '[true, true, true]'],
  ['with digits = 20: [contains(hypergeom([1, 1], [2], -1/2) - 2*log(3/2), 0), contains(lerchphi(1/2, 2, 1) - 2*polylog(2, 1/2), 0), contains(expint(1, 1) + ei(-1), 0)]', '[true, true, true]'],
  ['with digits = 20: [contains(erf(erfinv(1/3)) - 1/3, 0), contains(gammainc(2, 1) + gammainc(2, 1, lower = true) - 1, 0), contains(betainc(2, 3, 1/2, regularized = true) - 11/16, 0)]', '[true, true, true]'],
  ['with digits = 20: [contains(chebyshevt(1/2, 1/2) - sqrt(3)/2, 0), contains(legendrep(2, 1, 1/2) + 3*sqrt(3)/4, 0), contains(fresnelc(1) - 0.779893400376822829474206413653, 0)]', '[true, true, true]'],
  ['ring(hardyz(10)), ring(sphericalharmonic(1, 1, 1, 1)), chebyshevt(5, 1/2), hermiteh(3, 2), jacobip(2, 1, 1, 1/2)', '(RR, CC, 0.5, 40, 0.1875)'],
  ['x = gen(QQ[x]); chebyshevt(2, x + 1), laguerrel(2), gegenbauerc(2, 1), legendrep(2, x)', '(2*x^2 + 4*x + 1, 1/2*x^2 - 2*x + 1, 4*x^2 - 1, 3/2*x^2 - 1/2)'],
  // xgcd, séries, interpolação, Sturm, sqfree
  ['x = gen(QQ[x]); xgcd(x^3 - 1, x^2 + 1)', '(1, 1/2*x - 1/2, -1/2*x^2 + 1/2*x + 1/2)'],
  ['x = gen(GF(5)[x]); xgcd(x^2 + 1, x^3 + x), xgcd(240, 46)', '((x^2 + 1, 1, 0), (2, -9, 47))'],
  ['x = gen(QQ[x]); sqrt((x^2 + x/3 + 1)^2), sqrt(4*(x - 1)^2)', '(x^2 + 1/3*x + 1, 2*x - 2)'],
  ['x = gen(QQ[x]); series(exp, x, 5), series(inv, 1 - x - x^2, 7)', '(1/24*x^4 + 1/6*x^3 + 1/2*x^2 + x + 1, 13*x^6 + 8*x^5 + 5*x^4 + 3*x^3 + 2*x^2 + x + 1)'],
  ['x = gen(QQ[x]); series(sqrt, 4 + x, 3), series(log, 1 + x, 4), series(tan, x, 6)', '(-1/64*x^2 + 1/4*x + 2, 1/3*x^3 - 1/2*x^2 + x, 2/15*x^5 + 1/3*x^3 + x)'],
  ['x = gen(QQ[x]); revert(x - x^3/6, 8), revert(x - x^2, 5)', '(1/18*x^7 + 1/12*x^5 + 1/6*x^3 + x, 5*x^4 + 2*x^3 + x^2 + x)'],
  ['interpolate([0, 1, 2, 3], [1, 2, 5, 10]), interpolate([1/2, 2, 3], [1, 0, 7], var = "t")', '(x^2 + 1, 46/15*t^2 - 25/3*t + 22/5)'],
  ['interpolate(Zmod(7)(0..3), [1, 0, 0, 0])', 'x^3 + x^2 + 4*x + 1'],
  ['x = gen(QQ[x]); countrealroots(x^5 - x - 1), countrealroots((x^2 - 2)^3*(x^2 + 1)*x), countrealroots(chebyshevt(9)), countrealroots(x^2 + 1)', '(1, 3, 9, 0)'],
  ['x = gen(QQ[x]); sqfree((x - 1)^3*(x + 2)^2*(x^2 + 1)/4)', '1/4 * (x^2 + 1) * (x + 2)^2 * (x - 1)^3'],
  // polinômios em várias variáveis
  ['QQ[x, y], ZZ[x, y, order = "lex"], QQ[x]', '(QQ[x, y], ZZ[x, y, order = "lex"], QQ[x])'],
  ['(x, y) = gens(QQ[x, y]); (x + y)^3', 'x^3 + 3*x^2*y + 3*x*y^2 + y^3'],
  ['(x, y, z) = gens(QQ[x, y, z]); x + y^2 + z^3', 'z^3 + y^2 + x'],
  ['(x, y, z) = gens(QQ[x, y, z, order = "lex"]); x + y^2 + z^3', 'x + y^2 + z^3'],
  ['(x, y) = gens(ZZ[x, y]); factor(x^4 - y^4)', '(x + y) * (x - y) * (x^2 + y^2)'],
  ['(x, y) = gens(ZZ[x, y]); factor(6*x^2*y - 6*y^3)', '6 * y * (x + y) * (x - y)'],
  ['(x, y) = gens(Zmod(7)[x, y]); factor(x^7 + y^7)', '(x + y)^7'],
  ['(x, y) = gens(QQ[x, y]); gcd(x^2 - y^2, x^2 + 2*x*y + y^2), lcm(x, y)', '(x + y, x*y)'],
  ['(x, y) = gens(QQ[x, y]); (x^3 - y^3)/(x - y)', 'x^2 + x*y + y^2'],
  ['(x, y) = gens(ZZ[x, y]); (x^2 + y)/2, ring((x + y)/2)', '(1/2*x^2 + 1/2*y, QQ[x, y])'],
  ['(x, y) = gens(QQ[x, y]); divrem(x^2*y + x*y^2 + y^2, [x*y - 1, y^2 - 1])', '([x + y, 1], x + y + 1)'],
  ['(x, y) = gens(QQ[x, y]); divrem(x^2 + y, x + y)', '(x - y, y^2 + y)'],
  ['(x, y) = gens(QQ[x, y]); p = x^2*y + 3*x - 1; p(2, 5), subs(p, x = 1/2), subs(p, y, 0)', '(25, 1/4*y + 1/2, 3*x - 1)'],
  ['(x, y) = gens(QQ[x, y]); subs(x^2*y + 3*x - 1, x = y + 1)', 'y^3 + 2*y^2 + 4*y + 2'],
  ['(x, y) = gens(QQ[x, y]); p = x^2 + y; p([1, 2; 3, 4], 1)', '[8, 10; 15, 23]'],
  ['(x, y) = gens(QQ[x, y]); p = x^2 + y^2; p(3/2, i)', '1.25'],
  ['(x, y) = gens(QQ[x, y]); p = x^2*y + 3*x - 1; diff(p, x), diff(p, y, 2), integral(p, y)', '(2*x*y + 3, 0, 1/2*x^2*y^2 + 3*x*y - y)'],
  ['(x, y) = gens(QQ[x, y]); p = x^2*y^3 + x; deg(p), deg(p, x), deg(p, y), deg(0*x)', '(5, 2, 3, -1)'],
  ['(x, y) = gens(QQ[x, y]); p = (x + 2*y)^2; terms(p), monomials(p), coeffs(p), exponents(p)', '([x^2, 4*x*y, 4*y^2], [x^2, x*y, y^2], [1, 4, 4], [[2, 0], [1, 1], [0, 2]])'],
  ['(x, y) = gens(QQ[x, y]); p = (x + y + 1)^3; coeff(p, x*y), coeff(p, x, 2), lc(3*x*y + 1), lt(3*x*y + 1), lm(3*x*y + 1)', '(6, 3*y + 3, 3, 3*x*y, x*y)'],
  ['(x, y) = gens(QQ[x, y]); resultant(x^2 + y^2 - 1, x - y, y), disc(x^2 + y*x + 1, x)', '(2*x^2 - 1, y^2 - 4)'],
  ['x = gen(QQ[x]); y = gen(QQ[y]); x*y + 1, ring(x*y)', '(x*y + 1, QQ[x, y])'],
  ['t = gen(QQ[t]); (x, y) = gens(QQ[x, y]); (t^2 + 1)(x + y)', 'x^2 + 2*x*y + y^2 + 1'],
  ['(x, y) = gens(QQ[x, y]); QQ[x](x^2 + 1), ring(QQ[x](x^2 + 1)), len((x + y)^10)', '(x^2 + 1, QQ[x], 11)'],
  ['(x, y) = gens(QQ[x, y]); isirreducible(x^2 + y^2), issquarefree((x + y)^2*x), monic(3*x*y + 6)', '(true, false, x*y + 2)'],
  ['(x, y) = gens(QQ[x, y]); vars(x^2 + 1), vars(QQ[x, y]), gen(QQ[x, y], 2), gen(QQ[x, y], "x")', '([x], (x, y), y, x)'],
  ['(x, y) = gens(Zmod(5)[x, y]); lift(4*x + y), Zmod(5)(QQ[x, y](1/2))', '(4*x + y, 3)'],
  // matrizes
  ['kron([1, 2; 3, 4], [0, 1; 1, 0])', '[0, 1, 0, 2; 1, 0, 2, 0; 0, 3, 0, 4; 3, 0, 4, 0]'],
  ['[(round(l), [round(e) | e <- flatten(rows(v))]) | (l, v) <- eigenvectors([2, 1; 1, 2])]', '[(1, [1, -1]), (3, [1, 1])]'],
  ['A = [1, 2, 3; 4, 5, 6; 7, 8, 10]; all([all([contains(e, 0) | e <- flatten(rows(A*v - l*v))]) | (l, v) <- eigenvectors(A)])', 'true'],
  ['A = [1, 2; 3, 4]; det(A), trace(A), rank(A)', '(-2, 5, 2)'],
  ['A = [1, 2; 3, 4]; inverse(A)', '[-2, 1; 3/2, -1/2]'],
  ['A = [1, 2; 3, 4]; A * A', '[7, 10; 15, 22]'],
  ['A = [1, 2; 3, 4]; 2 * A + A', '[3, 6; 9, 12]'],
  ['A = [1, 2; 3, 4]; A^-1 * A', '[1, 0; 0, 1]'],
  ['A = [1, 2; 3, 4]; charpoly(A)', 'x^2 - 5*x - 2'],
  ['A = [1, 2; 3, 4]; transpose(A), A[2, 1]', '([1, 3; 2, 4], 3)'],
  ['A = [2, 1; 1, 3]; solve(A, [1, 2])', '[1/5, 3/5]'],
  ['H = matrix(4, 4, (i, j) -> 1/(i + j - 1)); det(H)', '1/6048000'],
  ['A = [1, 2, 3; 4, 5, 6]; nullspace(A)', '[[1, -2, 1]]'],
  ['A = [1, 2; 3, 4]; x = gen(ZZ[x]); p = charpoly(A); p(A)', '[0, 0; 0, 0]'],
  ['A = Zmod(5)([1, 2; 3, 4]); det(A), inverse(A)', '(3, [3, 1; 4, 2])'],
  ['hnf([2, 4; 6, 8])', '[2, 0; 0, 4]'],
  ['snf([2, 4; 6, 8])', '[2, 0; 0, 4]'],
  // linguagem
  ['[k^2 | k <- 1..10, isodd(k)]', '[1, 9, 25, 49, 81]'],
  ['[(a, b) | a <- 1..3, b <- a..3, a + b == 4]', '[(1, 3), (2, 2)]'],
  ['1..100 |> filter(isprime) |> sum', '1060'],
  ['f(0) = 1; f(n) = n * f(n - 1); f(20)', '2432902008176640000'],
  ['fib2(n) = if n < 2 then n else fib2(n - 1) + fib2(n - 2); fib2(15)', '610'],
  ['match factor(97) { [(q, 1)] => "primo"; _ => "composto" }', 'primo'],
  ['match [1, 2, 3] { [h, ...t] => t }', '[2, 3]'],
  ['let a = 3, b = 4 in sqrt(a^2 + b^2)', '5'],
  ['g = (x -> x + 1) ∘ (x -> 2x); g(5)', '11'],
  ['map([1, 2, 3], x -> x^2)', '[1, 4, 9]'],
  ['[1, 2, 3].map(x -> x * 10).sum', '60'],
  ['reduce(1..5, (a, b) -> a * b)', '120'],
  ['sort([3, 1, 2]), reverse([1, 2, 3])', '([1, 2, 3], [3, 2, 1])'],
  ['zip([1, 2], ["a", "b"])', '[(1, a), (2, b)]'],
  ['xs = [10, 20, 30]; xs[1], xs[-1]', '(10, 30)'],
  ['(a, b) = (1, 2); a + b', '3'],
  ['[0, ...[1, 2], 3]', '[0, 1, 2, 3]'],
  ['iterate(x -> x^2, 2, 4)', '[2, 4, 16, 256, 65536]'],
  ['"n = " + 10!', 'n = 3628800'],
  ['1..10 by 3', '[1, 4, 7, 10]'],
  ['10..1 by -4', '[10, 6, 2]'],
  ['2x where', (s) => s.startsWith('ERRO')],
  // erros
  ['1/0', 'ERRO: divisão por zero'],
  ['foo(3)', 'ERRO: nome não definido: foo'],
  ['[1, 2][5]', 'ERRO: índice 5 fora do intervalo 1..2'],
  ['if 1 then 2 else 3', 'ERRO: condição deve ser booleana (true/false)'],
  ['f(n) = f(n + 1); f(1)', 'ERRO: recursão profunda demais'],
  ['GF(6)', 'ERRO: GF(q) requer q potência de primo'],
  ['[1, 2; 3]', 'ERRO: linhas da matriz com tamanhos diferentes'],
  ['[1, 2; 3, 4] * [1, 2, 3; 4, 5, 6; 7, 8, 9]', (s) => s.startsWith('ERRO: dimensões incompatíveis')],
];

for (const [src, expected] of cases) {
  test(src, () => {
    const out = evalOne(src);
    if (typeof expected === 'function') assert.ok(expected(out), `obtido: ${out}`);
    else assert.equal(out, expected);
  });
}

test('pi com 1000 dígitos confere com a referência', () => {
  const out = evalOne('with digits = 1010: pi');
  assert.ok(out.startsWith(PI_50));
  // dígitos 991-1000 de π: ...2164201989
  assert.ok(out.replace('.', '').slice(0, 1001).endsWith('2164201989'), out.slice(980, 1010));
});

test('erros de parse informam posição', () => {
  assert.throws(() => parse('1 + * 2'), (e) => e.pos === 4);
  assert.throws(() => parse('f(x'), (e) => /esperado/.test(e.message));
});
