// Gráficos em SVG sem dependências: linhas (funções) e dispersão (pontos).

const NS = 'http://www.w3.org/2000/svg';

function el(name, attrs = {}, parent) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

// Passos "bonitos" para marcas dos eixos.
function ticks(lo, hi, n = 6) {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const raw = span / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + step * 1e-9; t += step) out.push(Math.abs(t) < step * 1e-9 ? 0 : t);
  return out;
}

function fmt(v) {
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e5 || a < 1e-3) return v.toExponential(1).replace('e', 'e');
  return String(+v.toPrecision(6));
}

// Intervalo robusto em y: ignora picos (polos) usando quantis.
function yRange(values) {
  const vs = values.filter((v) => v !== null && Number.isFinite(v)).sort((a, b) => a - b);
  if (!vs.length) return [-1, 1];
  const q = (p) => vs[Math.min(vs.length - 1, Math.max(0, Math.round(p * (vs.length - 1))))];
  let lo = vs[0], hi = vs[vs.length - 1];
  const qlo = q(0.02), qhi = q(0.98);
  const core = qhi - qlo;
  if (core > 0 && (hi - lo) > 20 * core) {
    lo = qlo - core * 0.5;
    hi = qhi + core * 0.5;
  }
  if (hi - lo < 1e-12) {
    const c = (hi + lo) / 2;
    const w = Math.abs(c) > 0 ? Math.abs(c) * 0.1 : 1;
    return [c - w, c + w];
  }
  const pad = (hi - lo) * 0.05;
  return [lo - pad, hi + pad];
}

export function renderPlot(d, width = 640) {
  const height = Math.round(Math.min(420, Math.max(220, width * 0.55)));
  const m = { l: 52, r: 16, t: d.title ? 28 : 12, b: 30 };
  const W = width - m.l - m.r, H = height - m.t - m.b;
  const all = d.series.flatMap((s) => s.points);
  const xs = all.map((p) => p[0]).filter(Number.isFinite);
  let [x0, x1] = d.xlim ?? (xs.length ? [Math.min(...xs), Math.max(...xs)] : [0, 1]);
  if (x1 - x0 < 1e-12) { x0 -= 1; x1 += 1; }
  let [y0, y1] = d.ylim ?? yRange(all.map((p) => p[1]));
  if (d.equal) {
    // Mesma escala nos dois eixos (plano complexo). Com limites dados, a
    // janela pedida é mantida e só o outro eixo é ampliado (sem margem).
    const sx = (x1 - x0) / W, sy = (y1 - y0) / H;
    const s = Math.max(sx, sy) * (d.xlim || d.ylim ? 1 : 1.1);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    x0 = cx - (s * W) / 2; x1 = cx + (s * W) / 2;
    y0 = cy - (s * H) / 2; y1 = cy + (s * H) / 2;
  } else if (d.kind === 'scatter' && !d.xlim) {
    const pad = (x1 - x0) * 0.04;
    x0 -= pad; x1 += pad;
  }
  const X = (x) => m.l + ((x - x0) / (x1 - x0)) * W;
  const Y = (y) => m.t + H - ((y - y0) / (y1 - y0)) * H;

  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', class: 'plot', role: 'img' });
  if (d.title) el('text', { x: m.l + W / 2, y: 18, class: 'ptitle', 'text-anchor': 'middle' }, svg).textContent = d.title;
  const clipId = 'c' + Math.random().toString(36).slice(2);
  const defs = el('defs', {}, svg);
  el('rect', { x: m.l, y: m.t, width: W, height: H }, el('clipPath', { id: clipId }, defs));

  const grid = el('g', { class: 'grid' }, svg);
  for (const t of ticks(x0, x1)) {
    el('line', { x1: X(t), x2: X(t), y1: m.t, y2: m.t + H }, grid);
    el('text', { x: X(t), y: m.t + H + 18, 'text-anchor': 'middle', class: 'tick' }, svg).textContent = fmt(t);
  }
  for (const t of ticks(y0, y1, 5)) {
    el('line', { x1: m.l, x2: m.l + W, y1: Y(t), y2: Y(t) }, grid);
    el('text', { x: m.l - 6, y: Y(t) + 4, 'text-anchor': 'end', class: 'tick' }, svg).textContent = fmt(t);
  }
  const axes = el('g', { class: 'axes' }, svg);
  if (y0 < 0 && y1 > 0) el('line', { x1: m.l, x2: m.l + W, y1: Y(0), y2: Y(0) }, axes);
  if (x0 < 0 && x1 > 0) el('line', { x1: X(0), x2: X(0), y1: m.t, y2: m.t + H }, axes);
  el('rect', { x: m.l, y: m.t, width: W, height: H, class: 'frame' }, svg);

  const body = el('g', { 'clip-path': `url(#${clipId})` }, svg);
  d.series.forEach((s, k) => {
    const cls = `series s${k % 6}`;
    if (d.kind === 'scatter') {
      const g = el('g', { class: cls }, body);
      for (const [x, y] of s.points) if (y !== null && Number.isFinite(y)) el('circle', { cx: X(x), cy: Y(y), r: 2.8 }, g);
    } else {
      let path = '';
      let pen = false;
      const span = y1 - y0;
      let prev = null;
      for (const [x, y] of s.points) {
        // Quebra a linha em descontinuidades (valores ausentes ou saltos enormes).
        if (y === null || !Number.isFinite(y) || (prev !== null && Math.abs(y - prev) > span * 4)) {
          pen = false;
          prev = y === null || !Number.isFinite(y) ? null : y;
          if (prev === null) continue;
        }
        const py = Math.max(-1e4, Math.min(1e4, Y(y)));
        path += `${pen ? 'L' : 'M'}${X(x).toFixed(2)},${py.toFixed(2)}`;
        pen = true;
        prev = y;
      }
      el('path', { d: path, class: cls }, body);
    }
  });

  if (d.series.length > 1) {
    const lg = el('g', { class: 'legend' }, svg);
    d.series.forEach((s, k) => {
      const y = m.t + 14 + k * 16;
      el('line', { x1: m.l + W - 70, x2: m.l + W - 52, y1: y - 4, y2: y - 4, class: `series s${k % 6}` }, lg);
      el('text', { x: m.l + W - 46, y, class: 'tick' }, lg).textContent = s.label || `f${k + 1}`;
    });
  }

  // Leitura de coordenadas ao passar o mouse.
  const hover = el('g', { class: 'hover', visibility: 'hidden' }, svg);
  const vline = el('line', { y1: m.t, y2: m.t + H }, hover);
  const dot = el('circle', { r: 3.5 }, hover);
  const label = el('text', { class: 'tick hoverlabel' }, hover);
  svg.addEventListener('pointermove', (ev) => {
    const rect = svg.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * width;
    if (px < m.l || px > m.l + W) { hover.setAttribute('visibility', 'hidden'); return; }
    const x = x0 + ((px - m.l) / W) * (x1 - x0);
    let best = null;
    for (const s of d.series) for (const p of s.points) {
      if (p[1] === null) continue;
      if (!best || Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p;
    }
    if (!best) return;
    hover.setAttribute('visibility', 'visible');
    vline.setAttribute('x1', X(best[0]));
    vline.setAttribute('x2', X(best[0]));
    dot.setAttribute('cx', X(best[0]));
    dot.setAttribute('cy', Math.max(m.t, Math.min(m.t + H, Y(best[1]))));
    label.textContent = `(${fmt(best[0])}, ${fmt(best[1])})`;
    const lx = X(best[0]) + 8;
    label.setAttribute('x', lx > m.l + W - 110 ? X(best[0]) - 8 : lx);
    label.setAttribute('text-anchor', lx > m.l + W - 110 ? 'end' : 'start');
    label.setAttribute('y', m.t + 14);
  });
  svg.addEventListener('pointerleave', () => hover.setAttribute('visibility', 'hidden'));
  return svg;
}
