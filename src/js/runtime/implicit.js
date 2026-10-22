// Conjunto zero de um polinômio p(x, y) em ponto flutuante: quadtree com
// aritmética intervalar (descarta caixas onde p não se anula), marching
// squares nas folhas, raízes refinadas sobre as arestas e encadeamento dos
// segmentos em poligonais.
//
// O polinômio chega como matriz densa C[i][j] = coeficiente de x^i y^j.

import { fail } from './errors.js';

// p(x, y) por Horner em y com coeficientes que são polinômios em x.
function evaluator(C) {
  const dx = C.length - 1, dy = C[0].length - 1;
  return (x, y) => {
    let acc = 0;
    for (let j = dy; j >= 0; j--) {
      let q = 0;
      for (let i = dx; i >= 0; i--) q = q * x + C[i][j];
      acc = acc * y + q;
    }
    return acc;
  };
}

// Intervalos [lo, hi]; a folga relativa cobre os arredondamentos.
const imul = (a0, a1, b0, b1) => {
  const p = a0 * b0, q = a0 * b1, r = a1 * b0, s = a1 * b1;
  return [Math.min(p, q, r, s), Math.max(p, q, r, s)];
};

// Extensão intervalar de Horner: contém p(caixa) (a menos de arredondamentos).
function intervalEvaluator(C) {
  const dx = C.length - 1, dy = C[0].length - 1;
  return (x0, x1, y0, y1) => {
    let a0 = 0, a1 = 0;
    for (let j = dy; j >= 0; j--) {
      let q0 = 0, q1 = 0;
      for (let i = dx; i >= 0; i--) {
        [q0, q1] = imul(q0, q1, x0, x1);
        q0 += C[i][j];
        q1 += C[i][j];
      }
      [a0, a1] = imul(a0, a1, y0, y1);
      a0 += q0;
      a1 += q1;
    }
    const slack = 1e-12 * (Math.abs(a0) + Math.abs(a1)) + 1e-300;
    return a0 - slack <= 0 && a1 + slack >= 0;
  };
}

// Raiz de f no segmento [0, 1] com f(0)·f(1) < 0 (regula falsi de Illinois).
function edgeRoot(f, fa, fb) {
  let a = 0, b = 1, side = 0;
  let t = 0.5;
  for (let k = 0; k < 12; k++) {
    t = (a * fb - b * fa) / (fb - fa);
    if (!(t > a && t < b)) t = (a + b) / 2;
    const ft = f(t);
    if (ft === 0) return t;
    if ((ft > 0) === (fb > 0)) {
      b = t;
      fb = ft;
      if (side === 1) fa /= 2;
      side = 1;
    } else {
      a = t;
      fa = ft;
      if (side === -1) fb /= 2;
      side = -1;
    }
  }
  return t;
}

// Poligonais que aproximam {p = 0} na janela; cada uma é {pts, closed}.
// `resolution` é o número de células por lado no nível mais fino (potência de 2).
export function zeroSet(C, { xlim, ylim, resolution = 512, maxCells = 400000 }) {
  const f = evaluator(C);
  const contains0 = intervalEvaluator(C);
  const depth = Math.round(Math.log2(resolution));
  const N = 2 ** depth;
  // Deslocamento irracional minúsculo: evita vértices da grade exatamente
  // sobre retas como x = 0 ou y = x.
  const hx = (xlim[1] - xlim[0]) / N, hy = (ylim[1] - ylim[0]) / N;
  const ox = xlim[0] - hx * 1e-3 * Math.SQRT2, oy = ylim[0] - hy * 1e-3 * Math.PI / 3;
  const X = (i) => ox + i * hx, Y = (j) => oy + j * hy;

  // Quadtree: folhas (i, j) no nível mais fino cujo intervalo contém 0.
  const leaves = [];
  const visit = (i, j, size) => {
    if (!contains0(X(i), X(i + size), Y(j), Y(j + size))) return;
    if (size === 1) {
      if (leaves.length >= maxCells) fail('implicitplot: curva complexa demais para a resolução; reduza resolution');
      leaves.push(i, j);
      return;
    }
    const h = size / 2;
    visit(i, j, h);
    visit(i + h, j, h);
    visit(i, j + h, h);
    visit(i + h, j + h, h);
  };
  visit(0, 0, N);

  // Valores nos vértices (compartilhados entre células vizinhas).
  const M = N + 1;
  const vals = new Map();
  const V = (i, j) => {
    const k = i * M + j;
    let v = vals.get(k);
    if (v === undefined) {
      v = f(X(i), Y(j));
      if (v === 0) v = Number.MIN_VALUE; // zero conta como positivo
      vals.set(k, v);
    }
    return v;
  };

  // Ponto da curva sobre cada aresta: horizontal (i, j)-(i+1, j) tem chave
  // 2(iM + j); vertical (i, j)-(i, j+1), 2(iM + j) + 1.
  const points = new Map();
  const edgePoint = (key) => {
    let p = points.get(key);
    if (p) return p;
    const base = key >> 1, i = Math.floor(base / M), j = base % M;
    const [i2, j2] = key & 1 ? [i, j + 1] : [i + 1, j];
    const ax = X(i), ay = Y(j), bx = X(i2), by = Y(j2);
    const t = edgeRoot((s) => f(ax + s * (bx - ax), ay + s * (by - ay)), V(i, j), V(i2, j2));
    p = [ax + t * (bx - ax), ay + t * (by - ay)];
    points.set(key, p);
    return p;
  };
  const H = (i, j) => 2 * (i * M + j), Vk = (i, j) => 2 * (i * M + j) + 1;

  // Marching squares: segmentos como pares de chaves de aresta.
  const adj = new Map();
  const link = (a, b) => {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push(b);
    adj.get(b).push(a);
  };
  for (let k = 0; k < leaves.length; k += 2) {
    const i = leaves[k], j = leaves[k + 1];
    // Cantos em ordem: (i,j), (i+1,j), (i+1,j+1), (i,j+1); arestas entre eles.
    const s = [V(i, j) > 0, V(i + 1, j) > 0, V(i + 1, j + 1) > 0, V(i, j + 1) > 0];
    const e = [H(i, j), Vk(i + 1, j), H(i, j + 1), Vk(i, j)];
    const cross = [0, 1, 2, 3].filter((q) => s[q] !== s[(q + 1) % 4]);
    if (cross.length === 2) link(e[cross[0]], e[cross[1]]);
    else if (cross.length === 4) {
      // Sela: o sinal do centro decide quais cantos ficam ligados.
      const c = f(X(i) + hx / 2, Y(j) + hy / 2) > 0;
      if (c === s[0]) {
        link(e[0], e[1]); // isola o canto 1
        link(e[2], e[3]); // isola o canto 3
      } else {
        link(e[3], e[0]); // isola o canto 0
        link(e[1], e[2]); // isola o canto 2
      }
    }
  }

  // Encadeia: primeiro as cadeias abertas (pontas de grau 1), depois os ciclos.
  const used = new Set();
  const lines = [];
  const walk = (start) => {
    const keys = [start];
    used.add(start);
    let prev = null, cur = start;
    for (;;) {
      const next = adj.get(cur).find((n) => n !== prev && !used.has(n));
      if (next === undefined) {
        const closed = keys.length > 2 && adj.get(cur).includes(start) && cur !== start;
        return { keys, closed };
      }
      used.add(next);
      keys.push(next);
      prev = cur;
      cur = next;
    }
  };
  for (const [k, ns] of adj) if (ns.length === 1 && !used.has(k)) lines.push(walk(k));
  for (const k of adj.keys()) if (!used.has(k)) lines.push(walk(k));
  return lines.map(({ keys, closed }) => ({ pts: keys.map(edgePoint), closed }));
}
