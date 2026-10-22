// Polinômios em várias variáveis (fmpz_mpoly, fmpq_mpoly, fmpz_mod_mpoly):
// contextos, alocação, acesso a termos e operações com resultados compostos.
// As operações uniformes (add, mul, gcd, ...) ficam em bindings.def.
//
// Tags: fmpz_mpoly (ZZ), fmpq_mpoly (QQ), zmod_mpoly (Z/nZ, fmpz_mod_mpoly).
// Os nomes das variáveis vivem só em JS; aqui as variáveis são índices.

#include "bridge.h"

/* ---------------------------------------------------------------- contextos */

/* ord: 0 = lex, 1 = deglex, 2 = degrevlex */
static ordering_t cy_ord(int ord)
{
    return ord == 0 ? ORD_LEX : ord == 1 ? ORD_DEGLEX : ORD_DEGREVLEX;
}

EMSCRIPTEN_KEEPALIVE void *cy_mctx_new_fmpz_mpoly(slong nvars, int ord)
{
    fmpz_mpoly_ctx_struct *ctx = flint_malloc(sizeof(fmpz_mpoly_ctx_struct));
    fmpz_mpoly_ctx_init(ctx, nvars, cy_ord(ord));
    return ctx;
}

EMSCRIPTEN_KEEPALIVE void *cy_mctx_new_fmpq_mpoly(slong nvars, int ord)
{
    fmpq_mpoly_ctx_struct *ctx = flint_malloc(sizeof(fmpq_mpoly_ctx_struct));
    fmpq_mpoly_ctx_init(ctx, nvars, cy_ord(ord));
    return ctx;
}

EMSCRIPTEN_KEEPALIVE void *cy_mctx_new_zmod_mpoly(slong nvars, int ord, const fmpz *n)
{
    fmpz_mod_mpoly_ctx_struct *ctx = flint_malloc(sizeof(fmpz_mod_mpoly_ctx_struct));
    fmpz_mod_mpoly_ctx_init(ctx, nvars, cy_ord(ord), n);
    return ctx;
}

/* ---------------------------------------------------------------- alocação */

#define MPOLY_ALLOC(tag, T)                                                   \
    EMSCRIPTEN_KEEPALIVE void *cy_new_##tag(const void *ctx)                  \
    {                                                                         \
        T##_struct *p = flint_malloc(sizeof(T##_struct));                     \
        T##_init(p, ctx);                                                     \
        return p;                                                             \
    }                                                                         \
    EMSCRIPTEN_KEEPALIVE void cy_free_##tag(void *p, const void *ctx)         \
    {                                                                         \
        T##_clear(p, ctx);                                                    \
        flint_free(p);                                                        \
    }

MPOLY_ALLOC(fmpz_mpoly, fmpz_mpoly)
MPOLY_ALLOC(fmpq_mpoly, fmpq_mpoly)
MPOLY_ALLOC(zmod_mpoly, fmpz_mod_mpoly)

/* ------------------------------------------------------- termos e construção */

/* CT: tag do coeficiente (fmpz, fmpq, zmod); GET/PUSH/SET recebem c, p, i, e. */
#define MPOLY_ACCESS(tag, T, CT, GETC, PUSH, SETC)                            \
    EMSCRIPTEN_KEEPALIVE slong cy_len_##tag(const T##_struct *p, const void *ctx) \
    {                                                                         \
        return T##_length(p, ctx);                                            \
    }                                                                         \
    EMSCRIPTEN_KEEPALIVE void *cy_term_coeff_##tag(const T##_struct *p, slong i, const void *ctx) \
    {                                                                         \
        void *c = cy_new_##CT(ctx);                                           \
        GETC;                                                                 \
        return c;                                                             \
    }                                                                         \
    /* Expoentes do termo i em e[0..nvars); 0 se algum não cabe em ulong. */  \
    EMSCRIPTEN_KEEPALIVE int cy_term_exp_##tag(const T##_struct *p, slong i, ulong *e, const void *ctx) \
    {                                                                         \
        if (!T##_term_exp_fits_ui(p, i, ctx))                                 \
            return 0;                                                         \
        T##_get_term_exp_ui(e, p, i, ctx);                                    \
        return 1;                                                             \
    }                                                                         \
    /* Acrescenta c·x^e sem normalizar; chamar cy_finish depois. */           \
    EMSCRIPTEN_KEEPALIVE void cy_push_##tag(T##_struct *p, const void *c, const ulong *e, const void *ctx) \
    {                                                                         \
        PUSH;                                                                 \
    }                                                                         \
    EMSCRIPTEN_KEEPALIVE void cy_finish_##tag(T##_struct *p, const void *ctx) \
    {                                                                         \
        T##_sort_terms(p, ctx);                                               \
        T##_combine_like_terms(p, ctx);                                       \
    }                                                                         \
    EMSCRIPTEN_KEEPALIVE void *cy_gen_##tag(slong i, const void *ctx)        \
    {                                                                         \
        T##_struct *p = cy_new_##tag(ctx);                                    \
        T##_gen(p, i, ctx);                                                   \
        return p;                                                             \
    }                                                                         \
    EMSCRIPTEN_KEEPALIVE void *cy_const_##tag(const void *c, const void *ctx) \
    {                                                                         \
        T##_struct *p = cy_new_##tag(ctx);                                    \
        SETC;                                                                 \
        return p;                                                             \
    }

MPOLY_ACCESS(fmpz_mpoly, fmpz_mpoly, fmpz,
             fmpz_mpoly_get_term_coeff_fmpz(c, p, i, ctx),
             fmpz_mpoly_push_term_fmpz_ui(p, c, e, ctx),
             fmpz_mpoly_set_fmpz(p, c, ctx))
MPOLY_ACCESS(fmpq_mpoly, fmpq_mpoly, fmpq,
             fmpq_mpoly_get_term_coeff_fmpq(c, p, i, ctx),
             fmpq_mpoly_push_term_fmpq_ui(p, c, e, ctx),
             fmpq_mpoly_set_fmpq(p, c, ctx))
MPOLY_ACCESS(zmod_mpoly, fmpz_mod_mpoly, zmod,
             fmpz_mod_mpoly_get_term_coeff_fmpz(c, p, i, ctx),
             fmpz_mod_mpoly_push_term_fmpz_ui(p, c, e, ctx),
             fmpz_mod_mpoly_set_fmpz(p, c, ctx))

/* --------------------------------------------------------------- avaliação */

/* vals: vetor de nvars ponteiros para coeficientes. */
EMSCRIPTEN_KEEPALIVE void *cy_eval_fmpz_mpoly(const fmpz_mpoly_t p, fmpz * const *vals, const fmpz_mpoly_ctx_t ctx)
{
    fmpz *r = cy_new_fmpz(NULL);
    if (!fmpz_mpoly_evaluate_all_fmpz(r, p, vals, ctx))
    {
        cy_free_fmpz(r, NULL);
        cy_error("avaliação grande demais");
    }
    return r;
}

EMSCRIPTEN_KEEPALIVE void *cy_eval_fmpq_mpoly(const fmpq_mpoly_t p, fmpq * const *vals, const fmpq_mpoly_ctx_t ctx)
{
    fmpq *r = cy_new_fmpq(NULL);
    if (!fmpq_mpoly_evaluate_all_fmpq(r, p, vals, ctx))
    {
        cy_free_fmpq(r, NULL);
        cy_error("avaliação grande demais");
    }
    return r;
}

EMSCRIPTEN_KEEPALIVE void *cy_eval_zmod_mpoly(const fmpz_mod_mpoly_t p, fmpz * const *vals, const fmpz_mod_mpoly_ctx_t ctx)
{
    fmpz *r = cy_new_fmpz(NULL);
    fmpz_mod_mpoly_evaluate_all_fmpz(r, p, vals, ctx);
    return r;
}

/* ------------------------------------------------------------- fatoração */

/* [constante, f1, e1, f2, e2, ...] */
#define MPOLY_FACTOR(tag, T, CT, SETCONST)                                    \
    EMSCRIPTEN_KEEPALIVE intptr_t *cy_factor_##tag(const T##_struct *p, const void *ctx) \
    {                                                                         \
        if (T##_is_zero(p, ctx))                                              \
            cy_error("não é possível fatorar o polinômio zero");              \
        T##_factor_t f;                                                       \
        T##_factor_init(f, ctx);                                              \
        if (!T##_factor(f, p, ctx))                                           \
        {                                                                     \
            T##_factor_clear(f, ctx);                                         \
            cy_error("fatoração falhou");                                     \
        }                                                                     \
        intptr_t *v = cy_vec_new(1 + 2 * f->num);                             \
        void *c = cy_new_##CT(ctx);                                           \
        SETCONST;                                                             \
        v[1] = (intptr_t) c;                                                  \
        for (slong i = 0; i < f->num; i++)                                    \
        {                                                                     \
            T##_struct *q = cy_new_##tag(ctx);                                \
            T##_set(q, f->poly + i, ctx);                                     \
            v[2 + 2 * i] = (intptr_t) q;                                      \
            fmpz *e = cy_new_fmpz(NULL);                                      \
            fmpz_set(e, f->exp + i);                                          \
            v[3 + 2 * i] = (intptr_t) e;                                      \
        }                                                                     \
        T##_factor_clear(f, ctx);                                             \
        return v;                                                             \
    }

MPOLY_FACTOR(fmpz_mpoly, fmpz_mpoly, fmpz, fmpz_set(c, f->constant))
MPOLY_FACTOR(fmpq_mpoly, fmpq_mpoly, fmpq, fmpq_set(c, f->constant))
MPOLY_FACTOR(zmod_mpoly, fmpz_mod_mpoly, zmod, fmpz_set(c, f->constant))

/* ------------------------------------------------------ divisão por ideal */

/* Divide a pelos n polinômios em bs: [r, q1, ..., qn] com a = Σ qi·bi + r. */
#define MPOLY_DIVREM_IDEAL(tag, T)                                            \
    EMSCRIPTEN_KEEPALIVE intptr_t *cy_divrem_ideal_##tag(const T##_struct *a, T##_struct * const *bs, slong n, const void *ctx) \
    {                                                                         \
        for (slong i = 0; i < n; i++)                                         \
            if (T##_is_zero(bs[i], ctx))                                      \
                cy_error("divisão por zero");                                 \
        intptr_t *v = cy_vec_new(n + 1);                                      \
        T##_struct *r = cy_new_##tag(ctx);                                    \
        v[1] = (intptr_t) r;                                                  \
        for (slong i = 0; i < n; i++)                                         \
            v[2 + i] = (intptr_t) cy_new_##tag(ctx);                          \
        T##_divrem_ideal((T##_struct **) (v + 2), r, a, (T##_struct * const *) bs, n, ctx); \
        return v;                                                             \
    }

MPOLY_DIVREM_IDEAL(fmpq_mpoly, fmpq_mpoly)
MPOLY_DIVREM_IDEAL(zmod_mpoly, fmpz_mod_mpoly)
