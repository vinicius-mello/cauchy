// Pequenos adaptadores usados por bindings.def: funções FLINT cuja assinatura
// tem parâmetros extras (flags) ou várias saídas.

#include "bridge.h"

void partitions_fmpz_fmpz_wrap(fmpz_t p, const fmpz_t n)
{
    if (fmpz_sgn(n) < 0)
        fmpz_zero(p);
    else
        partitions_fmpz_fmpz(p, n, 0);
}

static flint_rand_t cy_rand;
static int cy_rand_init = 0;

void h_fmpz_randm(fmpz_t r, const fmpz_t n)
{
    if (fmpz_sgn(n) <= 0)
        cy_error("random(n) requer n > 0");
    if (!cy_rand_init)
    {
        flint_rand_init(cy_rand);
        cy_rand_init = 1;
    }
    fmpz_randm(r, cy_rand, n);
}

void h_fmpq_floor(fmpz_t r, const fmpq_t x)
{
    fmpz_fdiv_q(r, fmpq_numref(x), fmpq_denref(x));
}

void h_arb_li(arb_t r, const arb_t x, slong prec) { arb_hypgeom_li(r, x, 0, prec); }
void h_arb_airy_ai(arb_t r, const arb_t x, slong prec) { arb_hypgeom_airy(r, NULL, NULL, NULL, x, prec); }
void h_arb_airy_bi(arb_t r, const arb_t x, slong prec) { arb_hypgeom_airy(NULL, NULL, r, NULL, x, prec); }
void h_arb_lambertw(arb_t r, const arb_t x, slong prec) { arb_lambertw(r, x, 0, prec); }
void h_arb_gamma_upper(arb_t r, const arb_t s, const arb_t x, slong prec) { arb_hypgeom_gamma_upper(r, s, x, 0, prec); }
void h_arb_beta_lower(arb_t r, const arb_t a, const arb_t b, const arb_t x, slong prec) { arb_hypgeom_beta_lower(r, a, b, x, 0, prec); }
void h_arb_get_mid(arb_t r, const arb_t x) { arb_get_mid_arb(r, x); }
void h_arb_get_rad(arb_t r, const arb_t x) { arb_get_rad_arb(r, x); }

void h_arb_interval(arb_t r, const arb_t a, const arb_t b, slong prec)
{
    arb_union(r, a, b, prec);
}

void h_acb_airy_ai(acb_t r, const acb_t x, slong prec) { acb_hypgeom_airy(r, NULL, NULL, NULL, x, prec); }
void h_acb_airy_bi(acb_t r, const acb_t x, slong prec) { acb_hypgeom_airy(NULL, NULL, r, NULL, x, prec); }
void h_acb_lambertw(acb_t r, const acb_t x, const fmpz_t k, slong prec) { acb_lambertw(r, x, k, 0, prec); }
void h_acb_hyp2f1(acb_t r, const acb_t a, const acb_t b, const acb_t c, const acb_t z, slong prec)
{
    acb_hypgeom_2f1(r, a, b, c, z, 0, prec);
}
void h_acb_gamma_upper(acb_t r, const acb_t s, const acb_t z, slong prec) { acb_hypgeom_gamma_upper(r, s, z, 0, prec); }

void h_acb_zeta_zero(acb_t r, const fmpz_t n, slong prec)
{
    if (fmpz_sgn(n) <= 0)
        cy_error("zetazero(n) requer n >= 1");
    acb_dirichlet_zeta_zero(r, n, prec);
}

void h_zmod_inv(fmpz_t r, const fmpz_t a, const fmpz_mod_ctx_t ctx)
{
    fmpz_t g;
    fmpz_init(g);
    fmpz_gcd(g, a, fmpz_mod_ctx_modulus(ctx));
    int ok = fmpz_is_one(g);
    fmpz_clear(g);
    if (!ok)
        cy_error("elemento não inversível em Z/nZ");
    fmpz_mod_inv(r, a, ctx);
}

void h_zmod_pow(fmpz_t r, const fmpz_t a, const fmpz_t e, const fmpz_mod_ctx_t ctx)
{
    if (!fmpz_mod_pow_fmpz(r, a, e, ctx))
        cy_error("elemento não inversível em Z/nZ");
}

void h_zmod_sqrt(fmpz_t r, const fmpz_t a, const fmpz_mod_ctx_t ctx)
{
    if (!fmpz_is_probabprime(fmpz_mod_ctx_modulus(ctx)))
        cy_error("sqrt em Z/nZ requer n primo");
    if (!fmpz_sqrtmod(r, a, fmpz_mod_ctx_modulus(ctx)))
        cy_error("não é um resíduo quadrático");
}

/* Ordem multiplicativa: fatora q-1 e remove primos enquanto possível. */
void h_fq_order(fmpz_t r, const fq_default_t a, const fq_default_ctx_t ctx)
{
    if (fq_default_is_zero(a, ctx))
        cy_error("0 não tem ordem multiplicativa");
    fmpz_t q, e;
    fq_default_t t;
    fmpz_init(q);
    fmpz_init(e);
    fq_default_init(t, ctx);
    fq_default_ctx_order(q, ctx);
    fmpz_sub_ui(r, q, 1);
    fmpz_factor_t f;
    fmpz_factor_init(f);
    fmpz_factor(f, r);
    for (slong i = 0; i < f->num; i++)
    {
        for (ulong k = 0; k < f->exp[i]; k++)
        {
            fmpz_divexact(e, r, f->p + i);
            fq_default_pow(t, a, e, ctx);
            if (!fq_default_is_one(t, ctx))
                break;
            fmpz_set(r, e);
        }
    }
    fmpz_factor_clear(f);
    fq_default_clear(t, ctx);
    fmpz_clear(e);
    fmpz_clear(q);
}

void h_fq_to_poly(fmpz_poly_t r, const fq_default_t a, const fq_default_ctx_t ctx)
{
    fmpz_t p;
    fmpz_init(p);
    fq_default_ctx_prime(p, ctx);
    fq_default_get_fmpz_poly(r, a, ctx);
    fmpz_poly_scalar_mod_fmpz(r, r, p);
    fmpz_clear(p);
}

void h_fq_from_poly(fq_default_t r, const fmpz_poly_t p, const fq_default_ctx_t ctx)
{
    fq_default_set_fmpz_poly(r, p, ctx);
}

void h_fmpz_poly_gen(fmpz_poly_t r)
{
    fmpz_poly_set_coeff_ui(r, 1, 1);
}

void h_fmpz_poly_evaluate_acb(acb_t r, const fmpz_poly_t p, const acb_t x, slong prec)
{
    arb_fmpz_poly_evaluate_acb(r, p, x, prec);
}

void h_fmpz_poly_evaluate_arb(arb_t r, const fmpz_poly_t p, const arb_t x, slong prec)
{
    arb_fmpz_poly_evaluate_arb(r, p, x, prec);
}

void h_fmpq_poly_evaluate_acb(acb_t r, const fmpq_poly_t p, const acb_t x, slong prec)
{
    acb_poly_t t;
    acb_poly_init(t);
    acb_poly_set_fmpq_poly(t, p, prec + 10);
    acb_poly_evaluate(r, t, x, prec);
    acb_poly_clear(t);
}

void h_fmpq_poly_evaluate_arb(arb_t r, const fmpq_poly_t p, const arb_t x, slong prec)
{
    arb_poly_t t;
    arb_poly_init(t);
    arb_poly_set_fmpq_poly(t, p, prec + 10);
    arb_poly_evaluate(r, t, x, prec);
    arb_poly_clear(t);
}

void h_fmpz_mat_lll(fmpz_mat_t r, const fmpz_mat_t a)
{
    fmpz_lll_t fl;
    fmpz_lll_context_init_default(fl);
    fmpz_mat_set(r, a);
    fmpz_lll(r, NULL, fl);
}

void h_fmpq_mat_scalar_mul(fmpq_mat_t r, const fmpq_mat_t a, const fmpq_t c)
{
    fmpq_mat_scalar_mul_fmpq(r, a, c);
}

void h_fmpq_mat_pow(fmpq_mat_t r, const fmpq_mat_t a, ulong e)
{
    slong n = fmpq_mat_nrows(a);
    if (n != fmpq_mat_ncols(a))
        cy_error("a matriz deve ser quadrada");
    fmpq_mat_t b, t;
    fmpq_mat_init_set(b, a);
    fmpq_mat_init(t, n, n);
    fmpq_mat_one(r);
    while (e)
    {
        if (e & 1)
        {
            fmpq_mat_mul(t, r, b);
            fmpq_mat_swap(t, r);
        }
        e >>= 1;
        if (e)
        {
            fmpq_mat_mul(t, b, b);
            fmpq_mat_swap(t, b);
        }
    }
    fmpq_mat_clear(t);
    fmpq_mat_clear(b);
}

slong h_fmpq_mat_rank(const fmpq_mat_t a)
{
    fmpq_mat_t b;
    fmpq_mat_init(b, fmpq_mat_nrows(a), fmpq_mat_ncols(a));
    slong r = fmpq_mat_rref(b, a);
    fmpq_mat_clear(b);
    return r;
}

/* Funções especiais com flags fixas ou várias saídas. */
void h_acb_hardy_z(acb_t r, const acb_t t, slong prec) { acb_dirichlet_hardy_z(r, t, NULL, NULL, 1, prec); }
void h_acb_hardy_theta(acb_t r, const acb_t t, slong prec) { acb_dirichlet_hardy_theta(r, t, NULL, NULL, 1, prec); }
void h_acb_legendre_p(acb_t r, const acb_t n, const acb_t m, const acb_t z, slong prec) { acb_hypgeom_legendre_p(r, n, m, z, 0, prec); }
void h_acb_legendre_q(acb_t r, const acb_t n, const acb_t m, const acb_t z, slong prec) { acb_hypgeom_legendre_q(r, n, m, z, 0, prec); }
void h_acb_hyp1f1(acb_t r, const acb_t a, const acb_t b, const acb_t z, slong reg, slong prec) { acb_hypgeom_m(r, a, b, z, reg, prec); }
void h_acb_hyp0f1(acb_t r, const acb_t a, const acb_t z, slong reg, slong prec) { acb_hypgeom_0f1(r, a, z, reg, prec); }
void h_acb_elliptic_f(acb_t r, const acb_t phi, const acb_t m, slong prec) { acb_elliptic_f(r, phi, m, 0, prec); }
void h_acb_elliptic_e_inc(acb_t r, const acb_t phi, const acb_t m, slong prec) { acb_elliptic_e_inc(r, phi, m, 0, prec); }
void h_acb_elliptic_pi_inc(acb_t r, const acb_t n, const acb_t phi, const acb_t m, slong prec) { acb_elliptic_pi_inc(r, n, phi, m, 0, prec); }
void h_acb_carlson_rf(acb_t r, const acb_t x, const acb_t y, const acb_t z, slong prec) { acb_elliptic_rf(r, x, y, z, 0, prec); }
void h_acb_carlson_rg(acb_t r, const acb_t x, const acb_t y, const acb_t z, slong prec) { acb_elliptic_rg(r, x, y, z, 0, prec); }
void h_acb_carlson_rj(acb_t r, const acb_t x, const acb_t y, const acb_t z, const acb_t p, slong prec) { acb_elliptic_rj(r, x, y, z, p, 0, prec); }

/* θ_j(z, τ), j = 1..4 */
void h_acb_theta(acb_t r, slong j, const acb_t z, const acb_t tau, slong prec)
{
    acb_t t1, t2, t3, t4;
    acb_init(t1); acb_init(t2); acb_init(t3); acb_init(t4);
    acb_modular_theta(t1, t2, t3, t4, z, tau, prec);
    acb_set(r, j == 1 ? t1 : j == 2 ? t2 : j == 3 ? t3 : t4);
    acb_clear(t1); acb_clear(t2); acb_clear(t3); acb_clear(t4);
}

/* Fresnel normalizadas: which = 0 para S, 1 para C. */
void h_arb_fresnel(arb_t r, slong which, const arb_t z, slong prec)
{
    arb_t o;
    arb_init(o);
    if (which == 0) arb_hypgeom_fresnel(r, o, z, 1, prec);
    else arb_hypgeom_fresnel(o, r, z, 1, prec);
    arb_clear(o);
}
void h_acb_fresnel(acb_t r, slong which, const acb_t z, slong prec)
{
    acb_t o;
    acb_init(o);
    if (which == 0) acb_hypgeom_fresnel(r, o, z, 1, prec);
    else acb_hypgeom_fresnel(o, r, z, 1, prec);
    acb_clear(o);
}

/* Funções de Coulomb: which = 0 para F, 1 para G. */
void h_acb_coulomb(acb_t r, slong which, const acb_t l, const acb_t eta, const acb_t z, slong prec)
{
    if (which == 0) acb_hypgeom_coulomb(r, NULL, NULL, NULL, l, eta, z, prec);
    else acb_hypgeom_coulomb(NULL, r, NULL, NULL, l, eta, z, prec);
}
