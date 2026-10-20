#!/usr/bin/env bash
# Compila a ponte C e liga com GMP/MPFR/FLINT em dist/cauchy.wasm (+ glue JS em build/obj).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PREFIX="$ROOT/build/prefix"
OBJ="$ROOT/build/obj"
OPT="${OPT:--O2}"

# shellcheck disable=SC1091
source "$ROOT/build/emsdk/emsdk_env.sh" >/dev/null 2>&1

mkdir -p "$OBJ" "$ROOT/dist"
node "$ROOT/tools/gen-bindings.mjs"

emcc $OPT -std=c11 -Wall -Wno-unused-function -Werror=implicit-function-declaration \
  -Werror=incompatible-pointer-types -I"$PREFIX/include" \
  "$ROOT/src/c/bridge.c" "$ROOT/src/c/bindings.gen.c" \
  "$PREFIX/lib/libflint.a" "$PREFIX/lib/libmpfr.a" "$PREFIX/lib/libgmp.a" \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createCauchy \
  -sENVIRONMENT=web,worker,node ${EXTRA:-} \
  -sALLOW_MEMORY_GROWTH=1 -sMAXIMUM_MEMORY=4GB -sSTACK_SIZE=4MB \
  -sEXPORTED_FUNCTIONS=_malloc,_free \
  -sEXPORTED_RUNTIME_METHODS=UTF8ToString,stringToNewUTF8,stackSave,stackRestore,HEAP32,HEAPU32,HEAPF64 \
  -o "$OBJ/cauchy.mjs"

cp "$OBJ/cauchy.wasm" "$ROOT/dist/cauchy.wasm"
ls -la "$ROOT/dist/cauchy.wasm"
