# Cauchy

Ambiente reativo de exploração numérica no navegador sobre **FLINT 3.6** (com GMP e MPFR),
compilado para WebAssembly. Uma página (`dist/index.html`) + `dist/cauchy.wasm`, sem
dependências em tempo de execução.

## Build

    npm run deps     # instala emsdk local e compila GMP/MPFR/FLINT (build/prefix) — uma vez
    npm run build    # gera bindings, compila a ponte C e empacota dist/
    npm test         # testes em node (wasm + linguagem + grafo reativo)
    npm run serve    # http://localhost:8080

## Estrutura

- `src/c/bindings.def` — tabela das operações FLINT expostas; `tools/gen-bindings.mjs` gera os wrappers.
- `src/c/bridge.c`, `helpers.c` — alocação, strings, fatorações, raízes, autovalores, erros.
- `src/js/runtime/` — anéis (ZZ, QQ, RR, CC, Zmod, GF, R[x], Mat), coerção, exibição.
- `src/js/lang/` — lexer, parser Pratt, avaliador, análise de variáveis livres, biblioteca.
- `src/js/notebook/` — grafo reativo de células (arenas de memória) e o Web Worker.
- `src/ui/` — interface (editor com realce, renderização matemática, gráficos SVG, widgets).
