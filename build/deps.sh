#!/usr/bin/env bash
# Instala o emsdk e compila GMP, MPFR e FLINT como bibliotecas estáticas wasm em build/prefix.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
EMSDK_DIR="$ROOT/emsdk"
SRC="$ROOT/src"
PREFIX="$ROOT/prefix"
JOBS="${JOBS:-$(nproc)}"

GMP_VER=6.3.0
MPFR_VER=4.2.2
FLINT_VER=3.6.0
EMSDK_VER="${EMSDK_VER:-latest}"

mkdir -p "$SRC" "$PREFIX"

if [ ! -d "$EMSDK_DIR" ]; then
  git clone --depth 1 https://github.com/emscripten-core/emsdk.git "$EMSDK_DIR"
fi
if [ ! -f "$EMSDK_DIR/.installed-$EMSDK_VER" ]; then
  "$EMSDK_DIR/emsdk" install "$EMSDK_VER"
  "$EMSDK_DIR/emsdk" activate "$EMSDK_VER"
  touch "$EMSDK_DIR/.installed-$EMSDK_VER"
fi
# shellcheck disable=SC1091
source "$EMSDK_DIR/emsdk_env.sh" >/dev/null

fetch() { # dir url...
  local dir="$1"; shift
  [ -d "$SRC/$dir" ] && return
  for url in "$@"; do
    if curl -fL --retry 3 "$url" -o "$SRC/$dir.tar.xz"; then
      tar -C "$SRC" -xf "$SRC/$dir.tar.xz" && return
    fi
  done
  echo "falha ao baixar $dir" >&2; exit 1
}

fetch "gmp-$GMP_VER" "https://ftpmirror.gnu.org/gmp/gmp-$GMP_VER.tar.xz" \
  "https://gmplib.org/download/gmp/gmp-$GMP_VER.tar.xz"
fetch "mpfr-$MPFR_VER" "https://ftpmirror.gnu.org/mpfr/mpfr-$MPFR_VER.tar.xz" \
  "https://www.mpfr.org/mpfr-$MPFR_VER/mpfr-$MPFR_VER.tar.xz"
fetch "flint-$FLINT_VER" "https://github.com/flintlib/flint/releases/download/v$FLINT_VER/flint-$FLINT_VER.tar.xz"

export CFLAGS="-O3"

if [ ! -f "$PREFIX/lib/libgmp.a" ]; then
  (cd "$SRC/gmp-$GMP_VER" &&
    emconfigure ./configure --host=none --build="$(./config.guess)" ABI=standard \
      CC_FOR_BUILD=cc --disable-assembly --enable-static --disable-shared \
      --disable-cxx --prefix="$PREFIX" &&
    emmake make -j"$JOBS" && emmake make install)
fi

if [ ! -f "$PREFIX/lib/libmpfr.a" ]; then
  (cd "$SRC/mpfr-$MPFR_VER" &&
    emconfigure ./configure --host=none --build="$(./config.guess 2>/dev/null || echo x86_64-pc-linux-gnu)" \
      --with-gmp="$PREFIX" --enable-static --disable-shared --disable-thread-safe \
      --prefix="$PREFIX" &&
    emmake make -j"$JOBS" && emmake make install)
fi

if [ ! -f "$PREFIX/lib/libflint.a" ]; then
  (cd "$SRC/flint-$FLINT_VER" &&
    emconfigure ./configure --host=wasm32-unknown-emscripten \
      --with-gmp="$PREFIX" --with-mpfr="$PREFIX" --enable-static --disable-shared \
      --disable-pthread --disable-assembly --disable-avx2 --disable-avx512 \
      --prefix="$PREFIX" &&
    emmake make -j"$JOBS" library && emmake make install)
fi

echo "ok: $PREFIX"
