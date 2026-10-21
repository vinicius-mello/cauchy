// Gráficos em SVG sem dependências. Recebe a árvore de primitivas montada no
// worker ({t: 'graphics', items, opts}) e a desenha em coordenadas do plano.

import { t } from './i18n.js';

const NS = 'http://www.w3.org/2000/svg';
const MAX_LEAVES = 20000;

function el(name, attrs = {}, parent) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
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
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}

function fmt(v) {
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e5 || a < 1e-3) return v.toExponential(1);
  return String(+v.toPrecision(6));
}

// Intervalo robusto em y para séries de dados: ignora picos (polos) usando quantis.
function yRange(values) {
  const vs = values.filter((v) => v !== null && Number.isFinite(v)).sort((a, b) => a - b);
  if (!vs.length) return null;
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

// Achata grupos, resolvendo a herança de atributos (o filho prevalece).
function flatten(items, inherited, out) {
  for (const it of items) {
    if (out.length >= MAX_LEAVES) { out.truncated = true; return out; }
    const attrs = { ...inherited, ...it.attrs };
    if (it.g === 'group') flatten(it.items, attrs, out);
    else out.push({ ...it, attrs });
  }
  return out;
}

function arcPoints(it) {
  const n = Math.max(8, Math.ceil((64 * (it.t1 - it.t0)) / (2 * Math.PI)));
  const out = [];
  for (let k = 0; k <= n; k++) {
    const a = it.t0 + ((it.t1 - it.t0) * k) / n;
    out.push([it.c[0] + it.r * Math.cos(a), it.c[1] + it.r * Math.sin(a)]);
  }
  return out;
}

// Caixa envolvente: [x0, x1, y0, y1] e se deve haver margem em x.
function bounds(leaves) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const dataY = [];
  const add = (x, y, data) => {
    if (!Number.isFinite(x)) return;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    if (data) dataY.push(y);
    else if (Number.isFinite(y)) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  };
  for (const it of leaves) {
    switch (it.g) {
      case 'circle': add(it.c[0] - it.r, it.c[1] - it.r); add(it.c[0] + it.r, it.c[1] + it.r); break;
      case 'arc': for (const p of arcPoints(it)) add(...p); if (it.sector) add(...it.c); break;
      case 'text': add(...it.p); break;
      default: for (const p of it.pts) if (p) add(p[0], p[1], it.data);
    }
  }
  if (x0 > x1) return null;
  const hasData = leaves.some((it) => it.data);
  const onlyDataLines = leaves.every((it) => it.data && it.g === 'line');
  let yr = null;
  if (y0 <= y1) {
    const pad = (y1 - y0) * 0.05;
    yr = [y0 - pad, y1 + pad];
  }
  if (hasData) {
    const dr = yRange(dataY);
    if (dr) yr = yr ? [Math.min(yr[0], dr[0]), Math.max(yr[1], dr[1])] : dr;
  }
  if (!yr) yr = [-1, 1];
  if (yr[1] - yr[0] < 1e-12) yr = [yr[0] - 1, yr[1] + 1];
  if (x1 - x0 < 1e-12) { x0 -= 1; x1 += 1; } else if (!onlyDataLines) {
    const pad = (x1 - x0) * 0.04;
    x0 -= pad; x1 += pad;
  }
  return [x0, x1, yr[0], yr[1]];
}

// Cores: índice da paleta (1 a 6), "ink" ou cor CSS já validada no worker.
function paint(c) {
  if (typeof c === 'number') return `var(--s${(c - 1) % 6})`;
  if (c === 'ink') return 'var(--ink)';
  return c ?? 'var(--s0)';
}

function styleOf(a, { fill = false, width = 1.5 } = {}) {
  const stroke = paint(a.color);
  const f = a.fill === true ? stroke : a.fill ? paint(a.fill) : fill ? stroke : 'none';
  return {
    stroke,
    fill: f,
    'stroke-width': a.width ?? width,
    'stroke-dasharray': a.dash ?? undefined,
    opacity: a.opacity ?? undefined,
    'stroke-linejoin': 'round',
    'stroke-linecap': 'round',
  };
}

// Caminho de marcadores (um só elemento para muitos pontos).
function markerPath(points, kind, r) {
  let d = '';
  for (const [x, y] of points) {
    switch (kind) {
      case 'square': d += `M${x - r},${y - r}h${2 * r}v${2 * r}h${-2 * r}Z`; break;
      case 'diamond': d += `M${x},${y - r * 1.3}l${r * 1.3},${r * 1.3}l${-r * 1.3},${r * 1.3}l${-r * 1.3},${-r * 1.3}Z`; break;
      case 'cross': d += `M${x - r},${y - r}l${2 * r},${2 * r}M${x - r},${y + r}l${2 * r},${-2 * r}`; break;
      case 'plus': d += `M${x - r},${y}h${2 * r}M${x},${y - r}v${2 * r}`; break;
      default: d += `M${x - r},${y}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`;
    }
  }
  return d;
}

export function renderGraphics(d, avail = 640) {
  const o = d.opts ?? {};
  const leaves = flatten(d.items, {}, []);
  const axes = o.axes !== false, grid = o.grid !== false, frame = o.frame !== false;
  const width = Math.round(o.width ?? avail);
  const m = axes ? { l: 52, r: 16, t: o.title ? 28 : 12, b: 30 } : { l: 12, r: 12, t: o.title ? 28 : 12, b: 12 };
  const W = width - m.l - m.r;

  let [x0, x1, y0, y1] = bounds(leaves) ?? [-1, 1, -1, 1];
  if (o.xlim) [x0, x1] = o.xlim;
  if (o.ylim) [y0, y1] = o.ylim;
  const equal = o.aspect !== 'auto';
  let height = o.height;
  if (!height) {
    // Em escala igual, a altura acompanha a proporção da região desenhada.
    const H = equal ? (W * (y1 - y0)) / (x1 - x0) : width * 0.55;
    height = Math.round(Math.min(equal ? 560 : 420, Math.max(220, H + m.t + m.b)));
  }
  const H = height - m.t - m.b;
  if (equal) {
    // Mesma escala nos dois eixos: a região pedida é mantida e só o outro
    // eixo é ampliado.
    const s = Math.max((x1 - x0) / W, (y1 - y0) / H);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    x0 = cx - (s * W) / 2; x1 = cx + (s * W) / 2;
    y0 = cy - (s * H) / 2; y1 = cy + (s * H) / 2;
  }
  const kx = W / (x1 - x0), ky = H / (y1 - y0);
  const clamp = (v) => Math.max(-1e5, Math.min(1e5, v));
  const X = (x) => clamp(m.l + (x - x0) * kx);
  const Y = (y) => clamp(m.t + H - (y - y0) * ky);
  const P = (p) => `${X(p[0]).toFixed(2)},${Y(p[1]).toFixed(2)}`;

  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', class: 'plot', role: 'img' });
  svg.style.width = `${width}px`;
  if (o.title) el('text', { x: m.l + W / 2, y: 18, class: 'ptitle', 'text-anchor': 'middle' }, svg).textContent = o.title;
  const clipId = 'c' + Math.random().toString(36).slice(2);
  el('rect', { x: m.l, y: m.t, width: W, height: H }, el('clipPath', { id: clipId }, el('defs', {}, svg)));

  const g = el('g', { class: 'grid' }, svg);
  for (const v of ticks(x0, x1)) {
    if (grid) el('line', { x1: X(v), x2: X(v), y1: m.t, y2: m.t + H }, g);
    if (axes) el('text', { x: X(v), y: m.t + H + 18, 'text-anchor': 'middle', class: 'tick' }, svg).textContent = fmt(v);
  }
  for (const v of ticks(y0, y1, 5)) {
    if (grid) el('line', { x1: m.l, x2: m.l + W, y1: Y(v), y2: Y(v) }, g);
    if (axes) el('text', { x: m.l - 6, y: Y(v) + 4, 'text-anchor': 'end', class: 'tick' }, svg).textContent = fmt(v);
  }
  if (axes) {
    const ax = el('g', { class: 'axes' }, svg);
    if (y0 < 0 && y1 > 0) el('line', { x1: m.l, x2: m.l + W, y1: Y(0), y2: Y(0) }, ax);
    if (x0 < 0 && x1 > 0) el('line', { x1: X(0), x2: X(0), y1: m.t, y2: m.t + H }, ax);
  }
  if (frame) el('rect', { x: m.l, y: m.t, width: W, height: H, class: 'frame' }, svg);

  const body = el('g', { 'clip-path': `url(#${clipId})` }, svg);
  for (const it of leaves) drawLeaf(it, body, { X, Y, P, kx, ky, W, H, m });
  if (leaves.truncated) {
    el('text', { x: m.l + W - 6, y: m.t + H - 6, 'text-anchor': 'end', class: 'tick' }, svg).textContent = t('graphicsTruncated', MAX_LEAVES);
  }

  const labeled = leaves.filter((it) => it.attrs.label);
  if (labeled.length) {
    const lg = el('g', { class: 'legend' }, svg);
    labeled.forEach((it, k) => {
      const y = m.t + 14 + k * 16;
      const st = styleOf(it.attrs);
      if (it.g === 'points') el('path', { d: markerPath([[m.l + W - 61, y - 4]], it.attrs.marker, 3), ...markerStyle(it.attrs) }, lg);
      else el('line', { x1: m.l + W - 70, x2: m.l + W - 52, y1: y - 4, y2: y - 4, ...st, fill: undefined }, lg);
      el('text', { x: m.l + W - 46, y, class: 'tick' }, lg).textContent = it.attrs.label;
    });
  }

  hover(svg, leaves, { width, height, x0, x1, y0, y1, X, Y, W, H, m });
  return svg;
}

function markerStyle(a) {
  const c = paint(a.color);
  const hollow = a.marker === 'circle' || a.marker === 'cross' || a.marker === 'plus';
  return { fill: hollow ? 'none' : c, stroke: hollow ? c : 'none', 'stroke-width': a.width ?? 1.4, opacity: a.opacity ?? undefined };
}

// Ponta de seta em b, apontando de a para b (coordenadas de tela); devolve o
// comprimento da ponta.
function arrowHead(body, [ax, ay], [bx, by], a, st) {
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const ux = (bx - ax) / len, uy = (by - ay) / len;
  const h = Math.min(len, 7 + 2 * (a.width ?? 1.5)), w = h * 0.45;
  el('path', {
    d: `M${bx},${by}L${bx - ux * h - uy * w},${by - uy * h + ux * w}L${bx - ux * h + uy * w},${by - uy * h - ux * w}Z`,
    ...st, fill: st.stroke, 'stroke-dasharray': undefined,
  }, body);
  return h;
}

function drawLeaf(it, body, { X, Y, P, kx, ky, W, H }) {
  const a = it.attrs;
  switch (it.g) {
    case 'points': {
      const ps = it.pts.filter((p) => p && p[1] !== null && Number.isFinite(p[1])).map((p) => [+X(p[0]).toFixed(2), +Y(p[1]).toFixed(2)]);
      el('path', { d: markerPath(ps, a.marker, a.size ?? 2.8), ...markerStyle(a) }, body);
      return;
    }
    case 'line': {
      let path = '';
      let pen = false, prev = null, broken = false;
      const span = H / ky;
      for (const p of it.pts) {
        const y = p ? p[1] : null;
        // Quebra a linha em valores ausentes e, em séries de dados, em saltos enormes (polos).
        if (y === null || !Number.isFinite(y) || (it.data && prev !== null && Math.abs(y - prev) > span * 4)) {
          pen = false;
          broken = true;
          prev = y === null || !Number.isFinite(y) ? null : y;
          if (prev === null) continue;
        }
        path += `${pen ? 'L' : 'M'}${P(p)}`;
        pen = true;
        prev = y;
      }
      if (it.closed && !broken && path) path += 'Z';
      const st = styleOf(a, { width: it.data ? 1.8 : 1.5 });
      el('path', { d: path, ...st }, body);
      if (it.arrow) {
        // Ponta na direção do último trecho (seta transformada).
        const ps = it.pts.filter(Boolean);
        const b = ps[ps.length - 1];
        const q = [...ps].reverse().find((p) => Math.hypot(X(p[0]) - X(b[0]), Y(p[1]) - Y(b[1])) > 2);
        if (b && q) arrowHead(body, [X(q[0]), Y(q[1])], [X(b[0]), Y(b[1])], a, st);
      }
      return;
    }
    case 'circle':
      el('ellipse', { cx: X(it.c[0]), cy: Y(it.c[1]), rx: it.r * kx, ry: it.r * ky, ...styleOf(a) }, body);
      return;
    case 'arc': {
      const ps = arcPoints(it);
      let path = (it.sector ? `M${P(it.c)}L` : 'M') + ps.map(P).join('L');
      if (it.sector) path += 'Z';
      el('path', { d: path, ...styleOf(a) }, body);
      return;
    }
    case 'arrow': {
      const st = styleOf(a);
      const [ax, ay] = [X(it.pts[0][0]), Y(it.pts[0][1])];
      const [bx, by] = [X(it.pts[1][0]), Y(it.pts[1][1])];
      const h = arrowHead(body, [ax, ay], [bx, by], a, st);
      const len = Math.hypot(bx - ax, by - ay) || 1;
      el('path', { d: `M${ax},${ay}L${bx - ((bx - ax) / len) * h * 0.8},${by - ((by - ay) / len) * h * 0.8}`, ...st, fill: 'none' }, body);
      return;
    }
    case 'infline':
    case 'ray': {
      const [ax, ay] = [X(it.pts[0][0]), Y(it.pts[0][1])];
      const [bx, by] = [X(it.pts[1][0]), Y(it.pts[1][1])];
      const len = Math.hypot(bx - ax, by - ay);
      if (!(len > 0)) return;
      const T = 2 * (W + H) + Math.hypot(ax, ay);
      const ux = (bx - ax) / len, uy = (by - ay) / len;
      const s = it.g === 'ray' ? 0 : -T;
      el('path', { d: `M${ax + ux * s},${ay + uy * s}L${ax + ux * T},${ay + uy * T}`, ...styleOf(a), fill: 'none' }, body);
      return;
    }
    case 'text': {
      const off = 6;
      const dx = it.pos.includes('e') ? off : it.pos.includes('w') ? -off : 0;
      const dy = it.pos.includes('n') ? -off : it.pos.includes('s') ? off : 0;
      const e = el('text', {
        x: X(it.p[0]) + dx, y: Y(it.p[1]) + dy,
        'text-anchor': dx > 0 ? 'start' : dx < 0 ? 'end' : 'middle',
        'dominant-baseline': dy < 0 ? 'auto' : dy > 0 ? 'hanging' : 'central',
        fill: a.color === undefined ? 'var(--ink)' : paint(a.color),
        'font-size': a.fontsize ?? 13,
        opacity: a.opacity ?? undefined,
        class: 'gtext',
      }, body);
      e.textContent = it.s;
    }
  }
}

// Leitura de coordenadas ao passar o mouse: em séries de dados, o ponto mais
// próximo em x; nos demais gráficos, a posição do cursor.
function hover(svg, leaves, { width, height, x0, x1, y0, y1, X, Y, W, H, m }) {
  const data = leaves.filter((it) => it.data).flatMap((it) => it.pts.filter((p) => p && p[1] !== null));
  const box = el('g', { class: 'hover', visibility: 'hidden' }, svg);
  const vline = el('line', { y1: m.t, y2: m.t + H }, box);
  const dot = el('circle', { r: 3.5 }, box);
  const label = el('text', { class: 'tick hoverlabel' }, box);
  if (!data.length) { vline.remove(); dot.remove(); }
  const place = (px, txt) => {
    label.textContent = txt;
    const right = px + 8 > m.l + W - 110;
    label.setAttribute('x', right ? px - 8 : px + 8);
    label.setAttribute('text-anchor', right ? 'end' : 'start');
    label.setAttribute('y', m.t + 14);
  };
  svg.addEventListener('pointermove', (ev) => {
    const rect = svg.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * width;
    const py = ((ev.clientY - rect.top) / rect.height) * height;
    if (px < m.l || px > m.l + W || py < m.t || py > m.t + H) { box.setAttribute('visibility', 'hidden'); return; }
    const x = x0 + ((px - m.l) / W) * (x1 - x0);
    box.setAttribute('visibility', 'visible');
    if (!data.length) {
      const y = y1 - ((py - m.t) / H) * (y1 - y0);
      place(px, `(${fmt(+x.toPrecision(4))}, ${fmt(+y.toPrecision(4))})`);
      return;
    }
    let best = data[0];
    for (const p of data) if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p;
    vline.setAttribute('x1', X(best[0]));
    vline.setAttribute('x2', X(best[0]));
    dot.setAttribute('cx', X(best[0]));
    dot.setAttribute('cy', Math.max(m.t, Math.min(m.t + H, Y(best[1]))));
    place(X(best[0]), `(${fmt(best[0])}, ${fmt(best[1])})`);
  });
  svg.addEventListener('pointerleave', () => box.setAttribute('visibility', 'hidden'));
}
