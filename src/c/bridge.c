// Ponte entre JS e FLINT: alocação de objetos, conversões de string, acesso a
// coeficientes/entradas e operações com resultados compostos. As operações
// uniformes ficam em bindings.def (wrappers gerados em bindings.gen.c).

#include "bridge.h"

#include <stdarg.h>
#include <stdio.h>
#include <string.h>

/* ------------------------------------------------------------------ erros */

EM_JS(void, cy_js_throw, (const char *msg), {
  throw new Module.FlintError(UTF8ToString(msg));
});

static char cy_errbuf[512];

static void cy_throw_handler(flint_err_t exc, const char *msg, va_list ap)
{
    (void) exc;
    vsnprintf(cy_errbuf, sizeof(cy_errbuf), msg, ap);
    cy_js_throw(cy_errbuf);
}

static void cy_abort_handler(void)
{
    cy_js_throw("FLINT abortou a operação");
}

void cy_error(const char *msg)
{
    cy_js_throw(msg);
}

EMSCRIPTEN_KEEPALIVE void cy_init(void)
{
    flint_set_throw(cy_throw_handler);
    flint_set_abort(cy_abort_handler);
}

EMSCRIPTEN_KEEPALIVE void cy_cleanup(void)
{
    flint_cleanup();
}

EMSCRIPTEN_KEEPALIVE void cy_free_str(char *s)
{
    flint_free(s);
}

static char *cy_strdup(const char *s)
{
    size_t n = strlen(s) + 1;
    char *r = flint_malloc(n);
    memcpy(r, s, n);
    return r;
}

/* Vetor de handles devolvido a JS: [len, x0, x1, ...] */
intptr_t *cy_vec_new(slong len)
{
    intptr_t *v = flint_malloc(sizeof(intptr_t) * (len + 1));
    v[0] = len;
    return v;
}

EMSCRIPTEN_KEEPALIVE void cy_vec_free(intptr_t *v)
{
    flint_free(v);
}

/* ---------------------------------------------------- alocação de escalares */

#define SCALAR_ALLOC(tag, T)                                                  \
    EMSCRIPTEN_KEEPALIVE void *cy_new_##tag(const void *ctx)                  \
    {                                                                         \
        (void) ctx;                                                           \
        T##_struct *p = flint_malloc(sizeof(T##_struct));                     \
        T##_init(p);                                                          \
        return p;                                                             \
    }                                                                         \
    EMSCRIPTEN_KEEPALIVE void cy_free_##tag(void *p, const void *ctx)         \
    {                                                                         \
        (void) ctx;                                                           \
        T##_clear(p);                                                         \
        flint_free(p);                                                        \
    }

#define CTX_ALLOC(tag, T, CTX)                                                \
    EMSCRIPTEN_KEEPALIVE void *cy_new_##tag(const void *ctx)                  \
    {                                                                         \
        T##_struct *p = flint_malloc(sizeof(T##_struct));                     \
        T##_init(p, (const CTX *) ctx);                                       \
        return p;                                                             \
    }                                                                         \
    EMSCRIPTEN_KEEPALIVE void cy_free_##tag(void *p, const void *ctx)         \
    {                                                                         \
        T##_clear(p, (const CTX *) ctx);                                      \
        flint_free(p);                                                        \
    }

#define MAT_ALLOC(tag, T)                                                     \
    EMSCRIPTEN_KEEPALIVE void *cy_new_##tag(slong r, slong c, const void *ctx) \
    {                                                                         \
        (void) ctx;                                                           \
        T##_struct *p = flint_malloc(sizeof(T##_struct));                     \
        T##_init(p, r, c);                                                    \
        return p;                                                             \
    }                                                                         \
    EMSCRIPTEN_KEEPALIVE void cy_free_##tag(void *p, const void *ctx)         \
    {                                                                         \
        (void) ctx;                                                           \
        T##_clear(p);                                                         \
        flint_free(p);                                                        \
    }

#define CTX_MAT_ALLOC(tag, T, CTX)                                            \
    EMSCRIPTEN_KEEPALIVE void *cy_new_##tag(slong r, slong c, const void *ctx) \
    {                                                                         \
        T##_struct *p = flint_malloc(sizeof(T##_struct));                     \
        T##_init(p, r, c, (const CTX *) ctx);                                 \
        return p;                                                             \
    }                                                                         \
    EMSCRIPTEN_KEEPALIVE void cy_free_##tag(void *p, const void *ctx)         \
    {                                                                         \
        T##_clear(p, (const CTX *) ctx);                                      \
        flint_free(p);                                                        \
    }

/* fmpz é um slong (sem _struct); trata à parte. */
EMSCRIPTEN_KEEPALIVE void *cy_new_fmpz(const void *ctx)
{
    (void) ctx;
    fmpz *p = flint_malloc(sizeof(fmpz));
    fmpz_init(p);
    return p;
}
EMSCRIPTEN_KEEPALIVE void cy_free_fmpz(void *p, const void *ctx)
{
    (void) ctx;
    fmpz_clear(p);
    flint_free(p);
}
EMSCRIPTEN_KEEPALIVE void *cy_new_fmpq(const void *ctx)
{
    (void) ctx;
    fmpq *p = flint_malloc(sizeof(fmpq));
    fmpq_init(p);
    return p;
}
EMSCRIPTEN_KEEPALIVE void cy_free_fmpq(void *p, const void *ctx)
{
    (void) ctx;
    fmpq_clear(p);
    flint_free(p);
}
/* Elementos de Z/nZ são fmpz reduzidos. */
EMSCRIPTEN_KEEPALIVE void *cy_new_zmod(const void *ctx) { return cy_new_fmpz(ctx); }
EMSCRIPTEN_KEEPALIVE void cy_free_zmod(void *p, const void *ctx) { cy_free_fmpz(p, ctx); }

SCALAR_ALLOC(arb, arb)
SCALAR_ALLOC(acb, acb)
SCALAR_ALLOC(fmpz_poly, fmpz_poly)
SCALAR_ALLOC(fmpq_poly, fmpq_poly)
SCALAR_ALLOC(arb_poly, arb_poly)
SCALAR_ALLOC(acb_poly, acb_poly)
CTX_ALLOC(zmod_poly, fmpz_mod_poly, fmpz_mod_ctx_struct)
CTX_ALLOC(fq, fq_default, fq_default_ctx_struct)
CTX_ALLOC(fq_poly, fq_default_poly, fq_default_ctx_struct)
MAT_ALLOC(fmpz_mat, fmpz_mat)
MAT_ALLOC(fmpq_mat, fmpq_mat)
MAT_ALLOC(arb_mat, arb_mat)
MAT_ALLOC(acb_mat, acb_mat)
CTX_MAT_ALLOC(zmod_mat, fmpz_mod_mat, fmpz_mod_ctx_struct)
CTX_MAT_ALLOC(fq_mat, fq_default_mat, fq_default_ctx_struct)

/* ---------------------------------------------------------------- contextos */

EMSCRIPTEN_KEEPALIVE void *cy_modctx_new(const fmpz *n)
{
    if (fmpz_cmp_ui(n, 1) <= 0)
        cy_error("o módulo deve ser maior que 1");
    fmpz_mod_ctx_struct *ctx = flint_malloc(sizeof(fmpz_mod_ctx_struct));
    fmpz_mod_ctx_init(ctx, n);
    return ctx;
}

EMSCRIPTEN_KEEPALIVE void *cy_fqctx_new(const fmpz *p, slong d, const char *var)
{
    if (!fmpz_is_probabprime(p))
        cy_error("a característica de GF(p^k) deve ser prima");
    if (d < 1)
        cy_error("o grau de GF(p^k) deve ser positivo");
    fq_default_ctx_struct *ctx = flint_malloc(sizeof(fq_default_ctx_struct));
    fq_default_ctx_init(ctx, p, d, var);
    return ctx;
}

EMSCRIPTEN_KEEPALIVE void *cy_fqctx_modulus(const fq_default_ctx_struct *ctx)
{
    fmpz_mod_ctx_t mctx;
    fmpz_t p;
    fmpz_init(p);
    fq_default_ctx_prime(p, ctx);
    fmpz_mod_ctx_init(mctx, p);
    fmpz_mod_poly_t m;
    fmpz_mod_poly_init(m, mctx);
    fq_default_ctx_modulus(m, ctx);
    fmpz_poly_struct *r = cy_new_fmpz_poly(NULL);
    fmpz_mod_poly_get_fmpz_poly(r, m, mctx);
    fmpz_mod_poly_clear(m, mctx);
    fmpz_mod_ctx_clear(mctx);
    fmpz_clear(p);
    return r;
}

/* ----------------------------------------------------- conversões de string */

EMSCRIPTEN_KEEPALIVE void *cy_fmpz_from_str(const char *s, int base)
{
    fmpz *r = cy_new_fmpz(NULL);
    if (fmpz_set_str(r, s, base) != 0)
    {
        cy_free_fmpz(r, NULL);
        cy_error("inteiro inválido");
    }
    return r;
}

EMSCRIPTEN_KEEPALIVE char *cy_fmpz_get_str(const fmpz *x, int base)
{
    return fmpz_get_str(NULL, base, x);
}

EMSCRIPTEN_KEEPALIVE void *cy_fmpz_from_si(slong x)
{
    fmpz *r = cy_new_fmpz(NULL);
    fmpz_set_si(r, x);
    return r;
}

EMSCRIPTEN_KEEPALIVE void *cy_fmpz_from_d(double x)
{
    fmpz *r = cy_new_fmpz(NULL);
    fmpz_set_d(r, x);
    return r;
}

/* Devolve 1 e escreve em *out se cabe em slong. */
EMSCRIPTEN_KEEPALIVE int cy_fmpz_get_si_checked(const fmpz *x, slong *out)
{
    if (!fmpz_fits_si(x))
        return 0;
    *out = fmpz_get_si(x);
    return 1;
}

EMSCRIPTEN_KEEPALIVE double cy_fmpz_get_d(const fmpz *x)
{
    return fmpz_get_d(x);
}

EMSCRIPTEN_KEEPALIVE char *cy_fmpq_get_str(const fmpq_t x, int base)
{
    return fmpq_get_str(NULL, base, x);
}

EMSCRIPTEN_KEEPALIVE void *cy_fmpq_from_fmpz2(const fmpz *num, const fmpz *den)
{
    if (fmpz_is_zero(den))
        cy_error("divisão por zero");
    fmpq *r = cy_new_fmpq(NULL);
    fmpz_set(fmpq_numref(r), num);
    fmpz_set(fmpq_denref(r), den);
    fmpq_canonicalise(r);
    return r;
}

/* Decimal exato: "1.25e-3" -> 1/800 */
EMSCRIPTEN_KEEPALIVE void *cy_fmpq_from_dec(const char *s)
{
    fmpq *r = cy_new_fmpq(NULL);
    fmpz_t num, ten;
    fmpz_init(num);
    fmpz_init_set_ui(ten, 10);
    slong exp10 = 0;
    char *digits = flint_malloc(strlen(s) + 1);
    slong nd = 0;
    const char *c = s;
    int frac = 0;
    for (; *c && *c != 'e' && *c != 'E'; c++)
    {
        if (*c == '.')
            frac = 1;
        else
        {
            digits[nd++] = *c;
            if (frac)
                exp10--;
        }
    }
    digits[nd] = 0;
    if (*c == 'e' || *c == 'E')
        exp10 += atol(c + 1);
    fmpz_set_str(num, digits, 10);
    flint_free(digits);
    fmpz_t p;
    fmpz_init(p);
    if (exp10 >= 0)
    {
        fmpz_pow_ui(p, ten, exp10);
        fmpz_mul(fmpq_numref(r), num, p);
        fmpz_one(fmpq_denref(r));
    }
    else
    {
        fmpz_pow_ui(p, ten, -exp10);
        fmpz_set(fmpq_numref(r), num);
        fmpz_set(fmpq_denref(r), p);
        fmpq_canonicalise(r);
    }
    fmpz_clear(p);
    fmpz_clear(num);
    fmpz_clear(ten);
    return r;
}

EMSCRIPTEN_KEEPALIVE void *cy_fmpq_num(const fmpq_t x)
{
    fmpz *r = cy_new_fmpz(NULL);
    fmpz_set(r, fmpq_numref(x));
    return r;
}

EMSCRIPTEN_KEEPALIVE void *cy_fmpq_den(const fmpq_t x)
{
    fmpz *r = cy_new_fmpz(NULL);
    fmpz_set(r, fmpq_denref(x));
    return r;
}

EMSCRIPTEN_KEEPALIVE double cy_fmpq_get_d(const fmpq_t x)
{
    return fmpq_get_d(x);
}

/* arb_get_str com n dígitos; flags: ARB_STR_MORE=1, ARB_STR_NO_RADIUS=2 */
EMSCRIPTEN_KEEPALIVE char *cy_arb_get_str(const arb_t x, slong n, int flags)
{
    return arb_get_str(x, n, flags);
}

EMSCRIPTEN_KEEPALIVE void *cy_arb_from_str(const char *s, slong prec)
{
    arb_struct *r = cy_new_arb(NULL);
    if (arb_set_str(r, s, prec) != 0)
    {
        cy_free_arb(r, NULL);
        cy_error("número real inválido");
    }
    return r;
}

EMSCRIPTEN_KEEPALIVE void *cy_arb_from_d(double x)
{
    arb_struct *r = cy_new_arb(NULL);
    arb_set_d(r, x);
    return r;
}

EMSCRIPTEN_KEEPALIVE double cy_arb_mid_d(const arb_t x)
{
    return arf_get_d(arb_midref(x), ARF_RND_NEAR);
}

EMSCRIPTEN_KEEPALIVE double cy_arb_rad_d(const arb_t x)
{
    return mag_get_d(arb_radref(x));
}

/* Comparações de bolas: 1 = verdadeiro, 0 = falso, -1 = indecidível. */
EMSCRIPTEN_KEEPALIVE int cy_arb_cmp3(const arb_t a, const arb_t b, int op)
{
    /* op: 0 ==, 1 <, 2 <= */
    switch (op)
    {
        case 0:
            if (arb_eq(a, b)) return 1;
            if (arb_ne(a, b)) return 0;
            return -1;
        case 1:
            if (arb_lt(a, b)) return 1;
            if (arb_ge(a, b)) return 0;
            return -1;
        default:
            if (arb_le(a, b)) return 1;
            if (arb_gt(a, b)) return 0;
            return -1;
    }
}

EMSCRIPTEN_KEEPALIVE int cy_acb_eq3(const acb_t a, const acb_t b)
{
    if (acb_eq(a, b)) return 1;
    if (acb_ne(a, b)) return 0;
    return -1;
}

EMSCRIPTEN_KEEPALIVE void *cy_acb_from_arb2(const arb_t re, const arb_t im)
{
    acb_struct *r = cy_new_acb(NULL);
    acb_set_arb_arb(r, re, im);
    return r;
}

/* Inteiro exato contido na bola, se único (para floor de valores exatos etc.). */
EMSCRIPTEN_KEEPALIVE void *cy_arb_get_unique_fmpz(const arb_t x)
{
    fmpz *r = cy_new_fmpz(NULL);
    if (!arb_get_unique_fmpz(r, x))
    {
        cy_free_fmpz(r, NULL);
        cy_error("a bola não determina um inteiro único; aumente a precisão");
    }
    return r;
}

EMSCRIPTEN_KEEPALIVE char *cy_fq_get_str(const fq_default_t x, const fq_default_ctx_t ctx)
{
    return fq_default_get_str_pretty(x, ctx);
}

/* --------------------------------------------- acesso a polinômios e matrizes */

#define POLY_ACCESS(tag, T, CT, LENEXPR, GETCOEFF, SETCOEFF)                  \
    EMSCRIPTEN_KEEPALIVE slong cy_len_##tag(const T##_struct *p, const void *ctx) \
    {                                                                         \
        (void) ctx;                                                           \
        return LENEXPR;                                                       \
    }                                                                         \
    EMSCRIPTEN_KEEPALIVE void *cy_coeff_##tag(const T##_struct *p, slong i, const void *ctx) \
    {                                                                         \
        void *c = cy_new_##CT(ctx);                                           \
        GETCOEFF;                                                             \
        return c;                                                             \
    }                                                                         \
    EMSCRIPTEN_KEEPALIVE void cy_setcoeff_##tag(T##_struct *p, slong i, const void *c, const void *ctx) \
    {                                                                         \
        (void) ctx;                                                           \
        SETCOEFF;                                                             \
    }

POLY_ACCESS(fmpz_poly, fmpz_poly, fmpz, fmpz_poly_length(p),
            fmpz_poly_get_coeff_fmpz(c, p, i), fmpz_poly_set_coeff_fmpz(p, i, c))
POLY_ACCESS(fmpq_poly, fmpq_poly, fmpq, fmpq_poly_length(p),
            fmpq_poly_get_coeff_fmpq(c, p, i), fmpq_poly_set_coeff_fmpq(p, i, c))
POLY_ACCESS(arb_poly, arb_poly, arb, arb_poly_length(p),
            arb_poly_get_coeff_arb(c, p, i), arb_poly_set_coeff_arb(p, i, c))
POLY_ACCESS(acb_poly, acb_poly, acb, acb_poly_length(p),
            acb_poly_get_coeff_acb(c, p, i), acb_poly_set_coeff_acb(p, i, c))
POLY_ACCESS(zmod_poly, fmpz_mod_poly, zmod, fmpz_mod_poly_length(p, ctx),
            fmpz_mod_poly_get_coeff_fmpz(c, p, i, ctx), fmpz_mod_poly_set_coeff_fmpz(p, i, c, ctx))
POLY_ACCESS(fq_poly, fq_default_poly, fq, fq_default_poly_length(p, ctx),
            fq_default_poly_get_coeff(c, p, i, ctx), fq_default_poly_set_coeff(p, i, c, ctx))

#define MAT_ACCESS(tag, T, ET, NR, NC, GET, SET)                              \
    EMSCRIPTEN_KEEPALIVE slong cy_nrows_##tag(const void *mv, const void *ctx) \
    {                                                                         \
        const T##_struct *m = mv;                                             \
        (void) ctx;                                                           \
        return NR;                                                            \
    }                                                                         \
    EMSCRIPTEN_KEEPALIVE slong cy_ncols_##tag(const void *mv, const void *ctx) \
    {                                                                         \
        const T##_struct *m = mv;                                             \
        (void) ctx;                                                           \
        return NC;                                                            \
    }                                                                         \
    EMSCRIPTEN_KEEPALIVE void *cy_entry_##tag(const T##_struct *m, slong i, slong j, const void *ctx) \
    {                                                                         \
        void *e = cy_new_##ET(ctx);                                           \
        GET;                                                                  \
        return e;                                                             \
    }                                                                         \
    EMSCRIPTEN_KEEPALIVE void cy_setentry_##tag(T##_struct *m, slong i, slong j, const void *e, const void *ctx) \
    {                                                                         \
        (void) ctx;                                                           \
        SET;                                                                  \
    }

MAT_ACCESS(fmpz_mat, fmpz_mat, fmpz, fmpz_mat_nrows(m), fmpz_mat_ncols(m),
           fmpz_set(e, fmpz_mat_entry(m, i, j)), fmpz_set(fmpz_mat_entry(m, i, j), e))
MAT_ACCESS(fmpq_mat, fmpq_mat, fmpq, fmpq_mat_nrows(m), fmpq_mat_ncols(m),
           fmpq_set(e, fmpq_mat_entry(m, i, j)), fmpq_set(fmpq_mat_entry(m, i, j), e))
MAT_ACCESS(arb_mat, arb_mat, arb, arb_mat_nrows(m), arb_mat_ncols(m),
           arb_set(e, arb_mat_entry(m, i, j)), arb_set(arb_mat_entry(m, i, j), e))
MAT_ACCESS(acb_mat, acb_mat, acb, acb_mat_nrows(m), acb_mat_ncols(m),
           acb_set(e, acb_mat_entry(m, i, j)), acb_set(acb_mat_entry(m, i, j), e))
MAT_ACCESS(zmod_mat, fmpz_mod_mat, zmod, fmpz_mod_mat_nrows(m, ctx), fmpz_mod_mat_ncols(m, ctx),
           fmpz_mod_mat_get_entry(e, m, i, j, ctx), fmpz_mod_mat_set_entry(m, i, j, e, ctx))
MAT_ACCESS(fq_mat, fq_default_mat, fq, fq_default_mat_nrows(m, ctx), fq_default_mat_ncols(m, ctx),
           fq_default_mat_entry(e, m, i, j, ctx), fq_default_mat_entry_set(m, i, j, e, ctx))

/* ------------------------------------------------- resultados compostos */

/* Fatoração de inteiros: [sinal, p1, e1, p2, e2, ...] com e_i como fmpz. */
EMSCRIPTEN_KEEPALIVE intptr_t *cy_fmpz_factor(const fmpz *n)
{
    if (fmpz_is_zero(n))
        cy_error("não é possível fatorar 0");
    fmpz_factor_t f;
    fmpz_factor_init(f);
    fmpz_factor(f, n);
    intptr_t *v = cy_vec_new(1 + 2 * f->num);
    v[1] = (intptr_t) cy_fmpz_from_si(f->sign);
    for (slong i = 0; i < f->num; i++)
    {
        fmpz *p = cy_new_fmpz(NULL);
        fmpz_set(p, f->p + i);
        v[2 + 2 * i] = (intptr_t) p;
        v[3 + 2 * i] = (intptr_t) cy_fmpz_from_si(f->exp[i]);
    }
    fmpz_factor_clear(f);
    return v;
}

#define POLY_FACTOR_OUT(T, fac, CTXARG, NEWPOLY, SET, UNIT)                   \
    do {                                                                      \
        intptr_t *v = cy_vec_new(1 + 2 * (fac)->num);                         \
        v[1] = (intptr_t) (UNIT);                                             \
        for (slong i = 0; i < (fac)->num; i++)                                \
        {                                                                     \
            void *q = NEWPOLY;                                                \
            SET;                                                              \
            v[2 + 2 * i] = (intptr_t) q;                                      \
            v[3 + 2 * i] = (intptr_t) cy_fmpz_from_si((fac)->exp[i]);         \
        }                                                                     \
        out = v;                                                              \
    } while (0)

/* [conteúdo, f1, e1, ...] */
EMSCRIPTEN_KEEPALIVE intptr_t *cy_fmpz_poly_factor(const fmpz_poly_t p)
{
    if (fmpz_poly_is_zero(p))
        cy_error("não é possível fatorar o polinômio zero");
    intptr_t *out;
    fmpz_poly_factor_t f;
    fmpz_poly_factor_init(f);
    fmpz_poly_factor(f, p);
    fmpz *c = cy_new_fmpz(NULL);
    fmpz_set(c, &f->c);
    POLY_FACTOR_OUT(fmpz_poly, f, , cy_new_fmpz_poly(NULL), fmpz_poly_set(q, f->p + i), c);
    fmpz_poly_factor_clear(f);
    return out;
}

/* Fatoração sobre QQ: [constante fmpq, f1, e1, ...] com fi primitivos em ZZ[x]. */
EMSCRIPTEN_KEEPALIVE intptr_t *cy_fmpq_poly_factor(const fmpq_poly_t p)
{
    if (fmpq_poly_is_zero(p))
        cy_error("não é possível fatorar o polinômio zero");
    intptr_t *out;
    fmpz_poly_t z;
    fmpz_poly_init(z);
    fmpq_poly_get_numerator(z, p);
    fmpz_poly_factor_t f;
    fmpz_poly_factor_init(f);
    fmpz_poly_factor(f, z);
    fmpq *c = cy_new_fmpq(NULL);
    fmpz_set(fmpq_numref(c), &f->c);
    fmpz_set(fmpq_denref(c), fmpq_poly_denref(p));
    fmpq_canonicalise(c);
    POLY_FACTOR_OUT(fmpq_poly, f, , cy_new_fmpq_poly(NULL), fmpq_poly_set_fmpz_poly(q, f->p + i), c);
    fmpz_poly_factor_clear(f);
    fmpz_poly_clear(z);
    return out;
}

EMSCRIPTEN_KEEPALIVE intptr_t *cy_zmod_poly_factor(const fmpz_mod_poly_t p, const fmpz_mod_ctx_t ctx)
{
    if (fmpz_mod_poly_is_zero(p, ctx))
        cy_error("não é possível fatorar o polinômio zero");
    if (!fmpz_is_probabprime(fmpz_mod_ctx_modulus(ctx)))
        cy_error("fatoração em Z/nZ[x] requer n primo");
    intptr_t *out;
    fmpz_mod_poly_factor_t f;
    fmpz_mod_poly_factor_init(f, ctx);
    fmpz_mod_poly_factor(f, p, ctx);
    fmpz *lc = cy_new_fmpz(NULL);
    fmpz_mod_poly_get_coeff_fmpz(lc, p, fmpz_mod_poly_degree(p, ctx), ctx);
    POLY_FACTOR_OUT(fmpz_mod_poly, f, ctx, cy_new_zmod_poly(ctx), fmpz_mod_poly_set(q, f->poly + i, ctx), lc);
    fmpz_mod_poly_factor_clear(f, ctx);
    return out;
}

EMSCRIPTEN_KEEPALIVE intptr_t *cy_fq_poly_factor(const fq_default_poly_t p, const fq_default_ctx_t ctx)
{
    if (fq_default_poly_is_zero(p, ctx))
        cy_error("não é possível fatorar o polinômio zero");
    fq_default_poly_factor_t f;
    fq_default_poly_factor_init(f, ctx);
    fq_default_struct *lc = cy_new_fq(ctx);
    fq_default_poly_factor(f, lc, p, ctx);
    slong num = fq_default_poly_factor_length(f, ctx);
    intptr_t *v = cy_vec_new(1 + 2 * num);
    v[1] = (intptr_t) lc;
    for (slong i = 0; i < num; i++)
    {
        fq_default_poly_struct *q = cy_new_fq_poly(ctx);
        fq_default_poly_factor_get_poly(q, f, i, ctx);
        v[2 + 2 * i] = (intptr_t) q;
        v[3 + 2 * i] = (intptr_t) cy_fmpz_from_si(fq_default_poly_factor_exp(f, i, ctx));
    }
    fq_default_poly_factor_clear(f, ctx);
    return v;
}

/* Raízes complexas isoladas rigorosamente de um polinômio inteiro. */
EMSCRIPTEN_KEEPALIVE intptr_t *cy_fmpz_poly_complex_roots(const fmpz_poly_t p, slong prec)
{
    slong d = fmpz_poly_degree(p);
    if (d < 1)
        return cy_vec_new(0);
    acb_ptr roots = _acb_vec_init(d);
    arb_fmpz_poly_complex_roots(roots, p, 0, prec);
    intptr_t *v = cy_vec_new(d);
    for (slong i = 0; i < d; i++)
    {
        acb_struct *r = cy_new_acb(NULL);
        acb_set_round(r, roots + i, prec);
        v[1 + i] = (intptr_t) r;
    }
    _acb_vec_clear(roots, d);
    return v;
}

/* Raízes reais isoladas de um polinômio inteiro (subconjunto das complexas). */
EMSCRIPTEN_KEEPALIVE intptr_t *cy_fmpz_poly_real_roots(const fmpz_poly_t p, slong prec)
{
    slong d = fmpz_poly_degree(p);
    if (d < 1)
        return cy_vec_new(0);
    acb_ptr roots = _acb_vec_init(d);
    arb_fmpz_poly_complex_roots(roots, p, 0, prec);
    slong n = 0;
    for (slong i = 0; i < d; i++)
        if (acb_is_real(roots + i))
            n++;
    intptr_t *v = cy_vec_new(n);
    for (slong i = 0, k = 0; i < d; i++)
    {
        if (acb_is_real(roots + i))
        {
            arb_struct *r = cy_new_arb(NULL);
            arb_set_round(r, acb_realref(roots + i), prec);
            v[1 + k++] = (intptr_t) r;
        }
    }
    _acb_vec_clear(roots, d);
    return v;
}

/* Raízes numéricas (com certificado quando possível) de um polinômio complexo. */
EMSCRIPTEN_KEEPALIVE intptr_t *cy_acb_poly_roots(const acb_poly_t p, slong prec)
{
    slong d = acb_poly_degree(p);
    if (d < 1)
        return cy_vec_new(0);
    acb_ptr roots = _acb_vec_init(d);
    slong wp = prec;
    for (int attempt = 0; attempt < 6; attempt++, wp *= 2)
    {
        slong isolated = acb_poly_find_roots(roots, p, NULL, 0, wp);
        if (isolated == d)
            break;
    }
    intptr_t *v = cy_vec_new(d);
    for (slong i = 0; i < d; i++)
    {
        acb_struct *r = cy_new_acb(NULL);
        acb_set_round(r, roots + i, prec);
        v[1 + i] = (intptr_t) r;
    }
    _acb_vec_clear(roots, d);
    return v;
}

EMSCRIPTEN_KEEPALIVE intptr_t *cy_zmod_poly_roots(const fmpz_mod_poly_t p, const fmpz_mod_ctx_t ctx)
{
    if (fmpz_mod_poly_is_zero(p, ctx))
        cy_error("o polinômio zero tem todas as raízes");
    if (!fmpz_is_probabprime(fmpz_mod_ctx_modulus(ctx)))
        cy_error("raízes em Z/nZ[x] requerem n primo");
    fmpz_mod_poly_factor_t f;
    fmpz_mod_poly_factor_init(f, ctx);
    fmpz_mod_poly_roots(f, p, 1, ctx);
    intptr_t *v = cy_vec_new(2 * f->num);
    for (slong i = 0; i < f->num; i++)
    {
        fmpz *r = cy_new_fmpz(NULL);
        fmpz_mod_poly_get_coeff_fmpz(r, f->poly + i, 0, ctx);
        fmpz_mod_neg(r, r, ctx);
        v[1 + 2 * i] = (intptr_t) r;
        v[2 + 2 * i] = (intptr_t) cy_fmpz_from_si(f->exp[i]);
    }
    fmpz_mod_poly_factor_clear(f, ctx);
    return v;
}

EMSCRIPTEN_KEEPALIVE intptr_t *cy_fq_poly_roots(const fq_default_poly_t p, const fq_default_ctx_t ctx)
{
    if (fq_default_poly_is_zero(p, ctx))
        cy_error("o polinômio zero tem todas as raízes");
    fq_default_poly_factor_t f;
    fq_default_poly_factor_init(f, ctx);
    fq_default_poly_roots(f, p, 1, ctx);
    slong num = fq_default_poly_factor_length(f, ctx);
    intptr_t *v = cy_vec_new(2 * num);
    fq_default_poly_t q;
    fq_default_poly_init(q, ctx);
    for (slong i = 0; i < num; i++)
    {
        fq_default_struct *r = cy_new_fq(ctx);
        fq_default_poly_factor_get_poly(q, f, i, ctx);
        fq_default_poly_get_coeff(r, q, 0, ctx);
        fq_default_neg(r, r, ctx);
        v[1 + 2 * i] = (intptr_t) r;
        v[2 + 2 * i] = (intptr_t) cy_fmpz_from_si(fq_default_poly_factor_exp(f, i, ctx));
    }
    fq_default_poly_clear(q, ctx);
    fq_default_poly_factor_clear(f, ctx);
    return v;
}

/* Divisão euclidiana: [q, r] */
#define DIVREM(tag, T, CHECKZERO, CALL, CTXP)                                 \
    EMSCRIPTEN_KEEPALIVE intptr_t *cy_divrem_##tag(const void *a, const void *b, const void *ctx) \
    {                                                                         \
        (void) ctx;                                                           \
        if (CHECKZERO)                                                        \
            cy_error("divisão por zero");                                     \
        T##_struct *q = cy_new_##tag(ctx);                                    \
        T##_struct *r = cy_new_##tag(ctx);                                    \
        CALL;                                                                 \
        intptr_t *v = cy_vec_new(2);                                          \
        v[1] = (intptr_t) q;                                                  \
        v[2] = (intptr_t) r;                                                  \
        return v;                                                             \
    }

DIVREM(fmpq_poly, fmpq_poly, fmpq_poly_is_zero(b), fmpq_poly_divrem(q, r, a, b), )
DIVREM(arb_poly, arb_poly, 0,
       if (!arb_poly_divrem(q, r, a, b, CY_PREC)) cy_error("divisão de polinômios indecidível (coeficiente líder contém zero)"), )
DIVREM(acb_poly, acb_poly, 0,
       if (!acb_poly_divrem(q, r, a, b, CY_PREC)) cy_error("divisão de polinômios indecidível (coeficiente líder contém zero)"), )
DIVREM(zmod_poly, fmpz_mod_poly, fmpz_mod_poly_is_zero(b, ctx),
       fmpz_mod_poly_divrem(q, r, a, b, ctx), )
DIVREM(fq_poly, fq_default_poly, fq_default_poly_is_zero(b, ctx),
       fq_default_poly_divrem(q, r, a, b, ctx), )

/* Divisão euclidiana de inteiros com resto não negativo (b > 0) / floor. */
EMSCRIPTEN_KEEPALIVE intptr_t *cy_divrem_fmpz(const fmpz *a, const fmpz *b, const void *ctx)
{
    (void) ctx;
    if (fmpz_is_zero(b))
        cy_error("divisão por zero");
    fmpz *q = cy_new_fmpz(NULL);
    fmpz *r = cy_new_fmpz(NULL);
    fmpz_fdiv_qr(q, r, a, b);
    intptr_t *v = cy_vec_new(2);
    v[1] = (intptr_t) q;
    v[2] = (intptr_t) r;
    return v;
}

/* xgcd(a, b) = [g, s, t] com g = s a + t b */
EMSCRIPTEN_KEEPALIVE intptr_t *cy_fmpz_xgcd(const fmpz *a, const fmpz *b)
{
    fmpz *g = cy_new_fmpz(NULL), *s = cy_new_fmpz(NULL), *t = cy_new_fmpz(NULL);
    fmpz_xgcd(g, s, t, a, b);
    intptr_t *v = cy_vec_new(3);
    v[1] = (intptr_t) g;
    v[2] = (intptr_t) s;
    v[3] = (intptr_t) t;
    return v;
}

/* Precisão de trabalho global, ajustada por JS antes de cada chamada que a usa. */
slong CY_PREC = 128;

EMSCRIPTEN_KEEPALIVE void cy_set_prec(slong prec)
{
    CY_PREC = prec;
}

/* Autovalores de matriz complexa (aproximados por QR e certificados quando simples). */
EMSCRIPTEN_KEEPALIVE intptr_t *cy_acb_mat_eig(const acb_mat_t A, slong prec)
{
    slong n = acb_mat_nrows(A);
    if (n != acb_mat_ncols(A))
        cy_error("a matriz deve ser quadrada");
    acb_ptr E = _acb_vec_init(n);
    acb_mat_t R;
    acb_mat_init(R, n, n);
    int ok = 0;
    for (slong wp = prec; wp <= 16 * prec && !ok; wp *= 2)
    {
        acb_mat_approx_eig_qr(E, NULL, R, A, NULL, 0, wp);
        ok = acb_mat_eig_simple(E, NULL, NULL, A, E, R, wp);
    }
    if (!ok)
        acb_mat_eig_multiple(E, A, E, R, prec);
    intptr_t *v = cy_vec_new(n);
    for (slong i = 0; i < n; i++)
    {
        acb_struct *r = cy_new_acb(NULL);
        acb_set_round(r, E + i, prec);
        v[1 + i] = (intptr_t) r;
    }
    acb_mat_clear(R);
    _acb_vec_clear(E, n);
    return v;
}

/* Inversa de matriz racional; erro se singular. */
EMSCRIPTEN_KEEPALIVE void *cy_fmpq_mat_inv(const fmpq_mat_t A)
{
    if (fmpq_mat_nrows(A) != fmpq_mat_ncols(A))
        cy_error("a matriz deve ser quadrada");
    fmpq_mat_struct *B = cy_new_fmpq_mat(fmpq_mat_nrows(A), fmpq_mat_ncols(A), NULL);
    if (!fmpq_mat_inv(B, A))
    {
        cy_free_fmpq_mat(B, NULL);
        cy_error("matriz singular");
    }
    return B;
}

EMSCRIPTEN_KEEPALIVE void *cy_fmpq_mat_solve(const fmpq_mat_t A, const fmpq_mat_t B)
{
    if (fmpq_mat_nrows(A) != fmpq_mat_ncols(A) || fmpq_mat_nrows(A) != fmpq_mat_nrows(B))
        cy_error("dimensões incompatíveis");
    fmpq_mat_struct *X = cy_new_fmpq_mat(fmpq_mat_ncols(A), fmpq_mat_ncols(B), NULL);
    if (!fmpq_mat_solve(X, A, B))
    {
        cy_free_fmpq_mat(X, NULL);
        cy_error("matriz singular");
    }
    return X;
}

EMSCRIPTEN_KEEPALIVE void *cy_fmpq_mat_rref(const fmpq_mat_t A)
{
    fmpq_mat_struct *B = cy_new_fmpq_mat(fmpq_mat_nrows(A), fmpq_mat_ncols(A), NULL);
    fmpq_mat_rref(B, A);
    return B;
}

/* Núcleo (espaço nulo à direita) de matriz racional: colunas formam uma base. */
EMSCRIPTEN_KEEPALIVE void *cy_fmpq_mat_nullspace(const fmpq_mat_t A)
{
    fmpz_mat_t Z, N;
    fmpz_mat_init(Z, fmpq_mat_nrows(A), fmpq_mat_ncols(A));
    fmpq_mat_get_fmpz_mat_rowwise(Z, NULL, A);
    fmpz_mat_init(N, fmpq_mat_ncols(A), fmpq_mat_ncols(A));
    slong k = fmpz_mat_nullspace(N, Z);
    fmpq_mat_struct *R = cy_new_fmpq_mat(fmpq_mat_ncols(A), k, NULL);
    for (slong i = 0; i < fmpq_mat_ncols(A); i++)
        for (slong j = 0; j < k; j++)
            fmpq_set_fmpz(fmpq_mat_entry(R, i, j), fmpz_mat_entry(N, i, j));
    fmpz_mat_clear(N);
    fmpz_mat_clear(Z);
    return R;
}

EMSCRIPTEN_KEEPALIVE void *cy_arb_mat_inv(const arb_mat_t A, slong prec)
{
    if (arb_mat_nrows(A) != arb_mat_ncols(A))
        cy_error("a matriz deve ser quadrada");
    arb_mat_struct *B = cy_new_arb_mat(arb_mat_nrows(A), arb_mat_ncols(A), NULL);
    if (!arb_mat_inv(B, A, prec))
    {
        cy_free_arb_mat(B, NULL);
        cy_error("não foi possível inverter (singular ou precisão insuficiente)");
    }
    return B;
}

EMSCRIPTEN_KEEPALIVE void *cy_acb_mat_inv(const acb_mat_t A, slong prec)
{
    if (acb_mat_nrows(A) != acb_mat_ncols(A))
        cy_error("a matriz deve ser quadrada");
    acb_mat_struct *B = cy_new_acb_mat(acb_mat_nrows(A), acb_mat_ncols(A), NULL);
    if (!acb_mat_inv(B, A, prec))
    {
        cy_free_acb_mat(B, NULL);
        cy_error("não foi possível inverter (singular ou precisão insuficiente)");
    }
    return B;
}

EMSCRIPTEN_KEEPALIVE void *cy_zmod_mat_inv(const fmpz_mod_mat_t A, const fmpz_mod_ctx_t ctx)
{
    slong n = fmpz_mod_mat_nrows(A, ctx);
    if (n != fmpz_mod_mat_ncols(A, ctx))
        cy_error("a matriz deve ser quadrada");
    if (!fmpz_is_probabprime(fmpz_mod_ctx_modulus(ctx)))
        cy_error("inversão em Z/nZ requer n primo");
    fmpz_mod_mat_struct *B = cy_new_zmod_mat(n, n, ctx);
    if (!fmpz_mod_mat_inv(B, A, ctx))
    {
        cy_free_zmod_mat(B, ctx);
        cy_error("matriz singular");
    }
    return B;
}

EMSCRIPTEN_KEEPALIVE void *cy_fq_mat_inv(const fq_default_mat_t A, const fq_default_ctx_t ctx)
{
    slong n = fq_default_mat_nrows(A, ctx);
    if (n != fq_default_mat_ncols(A, ctx))
        cy_error("a matriz deve ser quadrada");
    fq_default_mat_struct *B = cy_new_fq_mat(n, n, ctx);
    if (!fq_default_mat_inv(B, (fq_default_mat_struct *) A, ctx))
    {
        cy_free_fq_mat(B, ctx);
        cy_error("matriz singular");
    }
    return B;
}

EMSCRIPTEN_KEEPALIVE char *cy_version(void)
{
    char buf[128];
    snprintf(buf, sizeof(buf), "FLINT %s, GMP %s, MPFR %s", FLINT_VERSION, gmp_version, mpfr_get_version());
    return cy_strdup(buf);
}

/* ------------------------------------------- teoria dos números e polinômios */

/* n = root^k com k máximo devolvido pela FLINT (0 se não é potência): [root, k] */
EMSCRIPTEN_KEEPALIVE intptr_t *cy_fmpz_perfect_power(const fmpz *n)
{
    fmpz *r = cy_new_fmpz(NULL);
    int k = fmpz_is_perfect_power(r, n);
    intptr_t *v = cy_vec_new(2);
    v[1] = (intptr_t) r;
    v[2] = (intptr_t) cy_fmpz_from_si(k);
    return v;
}

/* Logaritmos discretos de a e g na base primitiva interna da FLINT, módulo
   o primo p: [log a, log g]. Recusa quando o custo estimado passa de maxcost. */
EMSCRIPTEN_KEEPALIVE intptr_t *cy_fmpz_dlog(const fmpz *a, const fmpz *g, const fmpz *p, double maxcost)
{
    fmpz_mod_discrete_log_pohlig_hellman_t L;
    fmpz_mod_discrete_log_pohlig_hellman_init(L);
    double cost = fmpz_mod_discrete_log_pohlig_hellman_precompute_prime(L, p);
    if (cost > maxcost)
    {
        fmpz_mod_discrete_log_pohlig_hellman_clear(L);
        cy_error("logaritmo discreto caro demais: p - 1 tem um fator primo grande");
    }
    fmpz *la = cy_new_fmpz(NULL), *lg = cy_new_fmpz(NULL);
    fmpz_mod_discrete_log_pohlig_hellman_run(la, L, a);
    fmpz_mod_discrete_log_pohlig_hellman_run(lg, L, g);
    fmpz_mod_discrete_log_pohlig_hellman_clear(L);
    intptr_t *v = cy_vec_new(2);
    v[1] = (intptr_t) la;
    v[2] = (intptr_t) lg;
    return v;
}

/* xgcd de polinômios: [g, s, t] com g = s·a + t·b */
#define POLY_XGCD(tag, T, CALL)                                               \
    EMSCRIPTEN_KEEPALIVE intptr_t *cy_xgcd_##tag(const void *a, const void *b, const void *ctx) \
    {                                                                         \
        (void) ctx;                                                           \
        T##_struct *g = cy_new_##tag(ctx), *s = cy_new_##tag(ctx), *t = cy_new_##tag(ctx); \
        CALL;                                                                 \
        intptr_t *v = cy_vec_new(3);                                          \
        v[1] = (intptr_t) g;                                                  \
        v[2] = (intptr_t) s;                                                  \
        v[3] = (intptr_t) t;                                                  \
        return v;                                                             \
    }

POLY_XGCD(fmpq_poly, fmpq_poly, fmpq_poly_xgcd(g, s, t, a, b))
POLY_XGCD(zmod_poly, fmpz_mod_poly, fmpz_mod_poly_xgcd(g, s, t, a, b, ctx))
POLY_XGCD(fq_poly, fq_default_poly, fq_default_poly_xgcd(g, s, t, a, b, ctx))

/* Fatoração livre de quadrados: [unidade, f1, e1, ...] (fi livres de quadrados, coprimos). */
EMSCRIPTEN_KEEPALIVE intptr_t *cy_sqfree_fmpz_poly(const fmpz_poly_t p)
{
    if (fmpz_poly_is_zero(p))
        cy_error("não é possível fatorar o polinômio zero");
    intptr_t *out;
    fmpz_poly_factor_t f;
    fmpz_poly_factor_init(f);
    fmpz_poly_factor_squarefree(f, p);
    fmpz *c = cy_new_fmpz(NULL);
    fmpz_set(c, &f->c);
    POLY_FACTOR_OUT(fmpz_poly, f, , cy_new_fmpz_poly(NULL), fmpz_poly_set(q, f->p + i), c);
    fmpz_poly_factor_clear(f);
    return out;
}

EMSCRIPTEN_KEEPALIVE intptr_t *cy_sqfree_zmod_poly(const fmpz_mod_poly_t p, const fmpz_mod_ctx_t ctx)
{
    if (fmpz_mod_poly_is_zero(p, ctx))
        cy_error("não é possível fatorar o polinômio zero");
    if (!fmpz_is_probabprime(fmpz_mod_ctx_modulus(ctx)))
        cy_error("fatoração em Z/nZ[x] requer n primo");
    intptr_t *out;
    fmpz_mod_poly_factor_t f;
    fmpz_mod_poly_factor_init(f, ctx);
    fmpz_mod_poly_t m;
    fmpz_mod_poly_init(m, ctx);
    fmpz_mod_poly_make_monic(m, p, ctx);
    fmpz_mod_poly_factor_squarefree(f, m, ctx);
    fmpz *lc = cy_new_fmpz(NULL);
    fmpz_mod_poly_get_coeff_fmpz(lc, p, fmpz_mod_poly_degree(p, ctx), ctx);
    POLY_FACTOR_OUT(fmpz_mod_poly, f, ctx, cy_new_zmod_poly(ctx), fmpz_mod_poly_set(q, f->poly + i, ctx), lc);
    fmpz_mod_poly_clear(m, ctx);
    fmpz_mod_poly_factor_clear(f, ctx);
    return out;
}

EMSCRIPTEN_KEEPALIVE intptr_t *cy_sqfree_fq_poly(const fq_default_poly_t p, const fq_default_ctx_t ctx)
{
    if (fq_default_poly_is_zero(p, ctx))
        cy_error("não é possível fatorar o polinômio zero");
    fq_default_poly_factor_t f;
    fq_default_poly_factor_init(f, ctx);
    fq_default_poly_t m;
    fq_default_poly_init(m, ctx);
    fq_default_poly_make_monic(m, p, ctx);
    fq_default_poly_factor_squarefree(f, m, ctx);
    fq_default_struct *lc = cy_new_fq(ctx);
    fq_default_poly_get_coeff(lc, p, fq_default_poly_degree(p, ctx), ctx);
    slong num = fq_default_poly_factor_length(f, ctx);
    intptr_t *v = cy_vec_new(1 + 2 * num);
    v[1] = (intptr_t) lc;
    for (slong i = 0; i < num; i++)
    {
        fq_default_poly_struct *q = cy_new_fq_poly(ctx);
        fq_default_poly_factor_get_poly(q, f, i, ctx);
        v[2 + 2 * i] = (intptr_t) q;
        v[3 + 2 * i] = (intptr_t) cy_fmpz_from_si(fq_default_poly_factor_exp(f, i, ctx));
    }
    fq_default_poly_clear(m, ctx);
    fq_default_poly_factor_clear(f, ctx);
    return v;
}

/* Autovalores e autovetores (colunas de R) de matriz complexa com autovalores
   simples: [λ1, ..., λn, R]. */
EMSCRIPTEN_KEEPALIVE intptr_t *cy_acb_mat_eigvec(const acb_mat_t A, slong prec)
{
    slong n = acb_mat_nrows(A);
    if (n != acb_mat_ncols(A))
        cy_error("a matriz deve ser quadrada");
    acb_ptr E = _acb_vec_init(n);
    acb_mat_t R, Ra;
    acb_mat_init(R, n, n);
    acb_mat_init(Ra, n, n);
    int ok = 0;
    for (slong wp = prec; wp <= 16 * prec && !ok; wp *= 2)
    {
        acb_mat_approx_eig_qr(E, NULL, Ra, A, NULL, 0, wp);
        ok = acb_mat_eig_simple(E, NULL, R, A, E, Ra, wp);
    }
    acb_mat_clear(Ra);
    if (!ok)
    {
        acb_mat_clear(R);
        _acb_vec_clear(E, n);
        cy_error("não foi possível certificar autovalores simples (autovalores múltiplos ou próximos demais)");
    }
    intptr_t *v = cy_vec_new(n + 1);
    for (slong i = 0; i < n; i++)
    {
        acb_struct *r = cy_new_acb(NULL);
        acb_set_round(r, E + i, prec);
        v[1 + i] = (intptr_t) r;
    }
    acb_mat_struct *M = cy_new_acb_mat(n, n, NULL);
    for (slong i = 0; i < n; i++)
        for (slong j = 0; j < n; j++)
            acb_set_round(acb_mat_entry(M, i, j), acb_mat_entry(R, i, j), prec);
    v[1 + n] = (intptr_t) M;
    acb_mat_clear(R);
    _acb_vec_clear(E, n);
    return v;
}

/* ₚFq(a; b; z): as e bs são vetores de ponteiros para acb. */
EMSCRIPTEN_KEEPALIVE void *cy_acb_pfq(acb_struct * const *as, slong p, acb_struct * const *bs, slong q,
                                      const acb_t z, int regularized, slong prec)
{
    acb_ptr a = _acb_vec_init(p), b = _acb_vec_init(q);
    for (slong i = 0; i < p; i++) acb_set(a + i, as[i]);
    for (slong i = 0; i < q; i++) acb_set(b + i, bs[i]);
    acb_struct *r = cy_new_acb(NULL);
    acb_hypgeom_pfq(r, a, p, b, q, z, regularized, prec);
    _acb_vec_clear(a, p);
    _acb_vec_clear(b, q);
    return r;
}

/* ------------------------------------------------- integração numérica */

/* O integrando é uma função da linguagem: o C chama Module.cyIntegrand, que
   devolve 0 quando f não pôde ser avaliada (ou não é holomorfa, se order ≥ 1). */
EM_JS(int, cy_js_integrand, (acb_ptr out, const acb_struct *inp, slong order, slong prec), {
  return Module.cyIntegrand(out, inp, order, prec);
});

static int cy_integrand(acb_ptr out, const acb_t inp, void *param, slong order, slong prec)
{
    (void) param;
    if (!cy_js_integrand(out, inp, order, prec))
        acb_indeterminate(out);
    return 0;
}

EMSCRIPTEN_KEEPALIVE void *cy_acb_integrate(const acb_t a, const acb_t b, slong eval_limit, slong prec)
{
    acb_struct *r = cy_new_acb(NULL);
    mag_t tol;
    mag_init(tol);
    mag_set_ui_2exp_si(tol, 1, -prec);
    acb_calc_integrate_opt_t opt;
    acb_calc_integrate_opt_init(opt);
    if (eval_limit > 0)
        opt->eval_limit = eval_limit;
    acb_calc_integrate(r, cy_integrand, NULL, a, b, prec, tol, opt, prec);
    mag_clear(tol);
    return r;
}

EMSCRIPTEN_KEEPALIVE void *cy_acb_copy(const acb_t x)
{
    acb_struct *r = cy_new_acb(NULL);
    acb_set(r, x);
    return r;
}

EMSCRIPTEN_KEEPALIVE void cy_acb_set_into(acb_t dst, const acb_t src)
{
    acb_set(dst, src);
}

/* Ponto médio e raio de uma bola como racionais exatos: [m, r]. */
EMSCRIPTEN_KEEPALIVE intptr_t *cy_arb_mid_rad_fmpq(const arb_t x)
{
    if (!arb_is_finite(x))
        cy_error("a bola não é finita");
    fmpq *m = cy_new_fmpq(NULL), *r = cy_new_fmpq(NULL);
    arf_get_fmpq(m, arb_midref(x));
    arf_t t;
    arf_init(t);
    arf_set_mag(t, arb_radref(x));
    arf_get_fmpq(r, t);
    arf_clear(t);
    intptr_t *v = cy_vec_new(2);
    v[1] = (intptr_t) m;
    v[2] = (intptr_t) r;
    return v;
}
