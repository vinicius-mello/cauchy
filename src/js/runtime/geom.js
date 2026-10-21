// Transformações de primitivas gráficas (dados em ponto flutuante).
//
// Afins: M = [a, b, c, d, e, f] leva (x, y) em (a x + b y + e, c x + d y + f).
// Círculos e arcos continuam exatos quando M é uma semelhança; caso
// contrário viram poligonais amostradas. Não lineares: tudo é amostrado e
// cada ponto é mapeado por uma função.

import { fail } from './errors.js';

const TAU = 2 * Math.PI;

export const affine = {
  translate: (vx, vy) => [1, 0, 0, 1, vx, vy],
  // Rotação de θ em torno de (cx, cy).
  rotate: (t, cx, cy) => {
    const c = Math.cos(t), s = Math.sin(t);
    return [c, -s, s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
  },
  scale: (kx, ky, cx, cy) => [kx, 0, 0, ky, cx - kx * cx, cy - ky * cy],
  // Reflexão na reta por (ax, ay) e (bx, by).
  reflect: (ax, ay, bx, by) => {
    const t = Math.atan2(by - ay, bx - ax);
    const c = Math.cos(2 * t), s = Math.sin(2 * t);
    return [c, s, s, -c, ax - c * ax - s * ay, ay - s * ax + c * ay];
  },
  linear: (a, b, c, d) => [a, b, c, d, 0, 0],
};

const apply = (M, p) => (p ? [M[0] * p[0] + M[1] * p[1] + M[4], M[2] * p[0] + M[3] * p[1] + M[5]] : p);

// Semelhança: +1 (preserva orientação), -1 (inverte) ou 0 (não é).
function similarity(M) {
  const [a, b, c, d] = M;
  const tol = 1e-12 * (Math.abs(a) + Math.abs(b) + Math.abs(c) + Math.abs(d));
  if (Math.abs(a - d) <= tol && Math.abs(b + c) <= tol) return 1;
  if (Math.abs(a + d) <= tol && Math.abs(b - c) <= tol) return -1;
  return 0;
}

// Pontos de um arco (ou círculo completo) com n segmentos.
function arcPts(c, r, t0, t1, n) {
  const out = [];
  for (let k = 0; k <= n; k++) {
    const a = t0 + ((t1 - t0) * k) / n;
    out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
  }
  return out;
}

// Converte círculos e arcos em poligonais (fechadas quando apropriado).
function toLine(it, n) {
  const { g, c, r, attrs } = it;
  if (g === 'circle') {
    const pts = arcPts(c, r, 0, TAU, n);
    pts.pop();
    return { g: 'line', pts, closed: true, attrs };
  }
  const m = Math.max(4, Math.ceil((n * (it.t1 - it.t0)) / TAU));
  const pts = arcPts(c, r, it.t0, it.t1, m);
  if (it.sector) return { g: 'line', pts: [c, ...pts], closed: true, attrs };
  return { g: 'line', pts, attrs };
}

export function affineItems(items, M) {
  const sim = similarity(M);
  const axis = M[1] === 0 && M[2] === 0;
  const det = Math.abs(M[0] * M[3] - M[1] * M[2]);
  const map = (it) => {
    if (it.g === 'group') return { ...it, items: it.items.map(map) };
    if (it.g === 'text') return { ...it, p: apply(M, it.p) };
    if (it.g === 'circle' || it.g === 'arc') {
      if (!sim) return map(toLine(it, 128));
      const out = { ...it, c: apply(M, it.c), r: it.r * Math.sqrt(det) };
      if (it.g === 'arc') {
        const phi = Math.atan2(M[2], M[0]);
        [out.t0, out.t1] = sim > 0 ? [it.t0 + phi, it.t1 + phi] : [phi - it.t1, phi - it.t0];
      }
      return out;
    }
    const out = { ...it, pts: it.pts.map((p) => apply(M, p)) };
    // Séries de dados só continuam séries se os eixos forem preservados.
    if (!axis || M[0] <= 0) delete out.data;
    return out;
  };
  return items.map(map);
}

// Subdivide cada segmento em k partes (preservando lacunas nulas).
function densify(pts, k, closed) {
  const out = [];
  const seq = closed && pts.length > 1 && pts[0] ? [...pts, pts[0]] : pts;
  for (let i = 0; i < seq.length; i++) {
    const p = seq[i], q = seq[i + 1];
    if (i === seq.length - 1) {
      if (!closed) out.push(p);
      break;
    }
    out.push(p);
    if (!p || !q) continue;
    for (let j = 1; j < k; j++) out.push([p[0] + ((q[0] - p[0]) * j) / k, p[1] + ((q[1] - p[1]) * j) / k]);
  }
  return out;
}

// Mapeia as primitivas por f: [x, y] -> [x, y] | null. `steps` fixa a
// subdivisão de cada segmento; sem ela, cerca de `budget` pontos por primitiva.
export function mapItems(items, f, { steps = null, budget = 2000, maxTotal = 200000 } = {}) {
  let total = 0;
  const F = (p) => {
    if (!p) return null;
    if (++total > maxTotal) fail('transform: pontos demais');
    return f(p);
  };
  const sub = (n) => steps ?? Math.max(1, Math.min(32, Math.ceil(budget / Math.max(1, n))));
  const map = (it) => {
    switch (it.g) {
      case 'group': return { ...it, items: it.items.map(map) };
      case 'text': {
        const p = F(it.p);
        return p ? { ...it, p } : null;
      }
      case 'points': {
        const out = { ...it, pts: it.pts.map(F).filter(Boolean) };
        delete out.data;
        return out;
      }
      case 'circle': case 'arc': {
        // Amostra a própria curva (e não cordas subdivididas, que sairiam dela).
        const n = steps ? 256 * steps : budget;
        const L = toLine(it, n);
        if (it.sector) {
          const arc = L.pts.slice(1);
          const k = Math.max(8, Math.round(n / 16));
          L.pts = [...densify([it.c, arc[0]], k, false).slice(0, -1), ...arc, ...densify([arc[arc.length - 1], it.c], k, false).slice(1, -1)];
        }
        return { ...L, pts: L.pts.map(F) };
      }
      case 'arrow': return { g: 'line', arrow: true, pts: densify(it.pts, steps ?? 64, false).map(F), attrs: it.attrs };
      case 'infline': case 'ray': fail('transform não se aplica a retas infinitas (use segment)');
      default: {
        const n = it.pts.length - (it.closed ? 0 : 1);
        const out = { ...it, pts: densify(it.pts, sub(n), it.closed).map(F) };
        delete out.data;
        return out;
      }
    }
  };
  return items.map(map).filter(Boolean);
}
