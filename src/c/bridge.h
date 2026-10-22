#ifndef CAUCHY_BRIDGE_H
#define CAUCHY_BRIDGE_H

#include <stdint.h>
#include <emscripten.h>

#include <gmp.h>
#include <mpfr.h>
#include <flint/flint.h>
#include <flint/fmpz.h>
#include <flint/fmpz_factor.h>
#include <flint/fmpq.h>
#include <flint/arb.h>
#include <flint/acb.h>
#include <flint/arb_hypgeom.h>
#include <flint/acb_hypgeom.h>
#include <flint/acb_modular.h>
#include <flint/acb_elliptic.h>
#include <flint/acb_dirichlet.h>
#include <flint/arith.h>
#include <flint/fmpz_poly.h>
#include <flint/fmpz_poly_factor.h>
#include <flint/fmpq_poly.h>
#include <flint/arb_poly.h>
#include <flint/acb_poly.h>
#include <flint/arb_fmpz_poly.h>
#include <flint/fmpz_mod.h>
#include <flint/fmpz_mod_poly.h>
#include <flint/fmpz_mod_poly_factor.h>
#include <flint/fq_default.h>
#include <flint/fq_default_poly.h>
#include <flint/fq_default_poly_factor.h>
#include <flint/fq_default_mat.h>
#include <flint/fmpz_mat.h>
#include <flint/fmpz_lll.h>
#include <flint/fmpq_mat.h>
#include <flint/arb_mat.h>
#include <flint/acb_mat.h>
#include <flint/fmpz_mod_mat.h>
#include <flint/ulong_extras.h>
#include <flint/partitions.h>
#include <flint/bernoulli.h>
#include <flint/acb_calc.h>
#include <flint/fmpz_mpoly.h>
#include <flint/fmpz_mpoly_factor.h>
#include <flint/fmpq_mpoly.h>
#include <flint/fmpq_mpoly_factor.h>
#include <flint/fmpz_mod_mpoly.h>
#include <flint/fmpz_mod_mpoly_factor.h>

extern slong CY_PREC;

void cy_error(const char *msg);
intptr_t *cy_vec_new(slong len);

void *cy_new_fmpz(const void *ctx);
void *cy_new_zmod(const void *ctx);
void *cy_new_fmpq(const void *ctx);
void *cy_new_arb(const void *ctx);
void *cy_new_acb(const void *ctx);
void *cy_new_fmpz_poly(const void *ctx);
void *cy_new_fmpq_poly(const void *ctx);
void *cy_new_arb_poly(const void *ctx);
void *cy_new_acb_poly(const void *ctx);
void *cy_new_zmod_poly(const void *ctx);
void *cy_new_fq(const void *ctx);
void *cy_new_fq_poly(const void *ctx);
void *cy_new_fmpz_mat(slong r, slong c, const void *ctx);
void *cy_new_fmpq_mat(slong r, slong c, const void *ctx);
void *cy_new_arb_mat(slong r, slong c, const void *ctx);
void *cy_new_acb_mat(slong r, slong c, const void *ctx);
void *cy_new_zmod_mat(slong r, slong c, const void *ctx);
void *cy_new_fq_mat(slong r, slong c, const void *ctx);
void *cy_new_fmpz_mpoly(const void *ctx);
void *cy_new_fmpq_mpoly(const void *ctx);
void *cy_new_zmod_mpoly(const void *ctx);
void cy_free_fmpz(void *p, const void *ctx);
void cy_free_fmpq(void *p, const void *ctx);
slong cy_nrows_fmpz_mat(const void *m, const void *ctx);
slong cy_ncols_fmpz_mat(const void *m, const void *ctx);
slong cy_nrows_fmpq_mat(const void *m, const void *ctx);
slong cy_ncols_fmpq_mat(const void *m, const void *ctx);
slong cy_nrows_arb_mat(const void *m, const void *ctx);
slong cy_ncols_arb_mat(const void *m, const void *ctx);
slong cy_nrows_acb_mat(const void *m, const void *ctx);
slong cy_ncols_acb_mat(const void *m, const void *ctx);
slong cy_nrows_zmod_mat(const void *m, const void *ctx);
slong cy_ncols_zmod_mat(const void *m, const void *ctx);
slong cy_nrows_fq_mat(const void *m, const void *ctx);
slong cy_ncols_fq_mat(const void *m, const void *ctx);

#endif
