// Gráficos 3D com three.js. A biblioteca (dist/three.module.min.js) só é
// baixada quando aparece a primeira figura 3D. Recebe do worker
// {t: 'graphics3d', items, opts}: pontos, poligonais, retas, planos, esferas,
// textos e malhas (grades de vértices em Float32Array, NaN nas lacunas).
//
// Cada célula guarda suas figuras (uma por slot): reavaliar a célula refaz a
// cena no mesmo contexto WebGL e mantém a câmera. Figuras fora do documento
// são liberadas, porque os navegadores limitam os contextos WebGL.

import { t } from './i18n.js';
import { ticks, fmt, flatten } from './plot.js';

let THREE = null;
let loading = null;
function loadThree() {
  loading ??= import(new URL('three.module.min.js', document.baseURI).href).then((m) => (THREE = m));
  return loading;
}

const live = new Set();

// Monta (ou atualiza) a figura `key` da célula em lugar de `slot`.
export function mount3d(figs, key, slot, d, avail) {
  let fig = figs.get(key);
  if (!fig || fig.disposed) {
    fig = new Figure(figs, key);
    figs.set(key, fig);
  }
  slot.replaceWith(fig.el);
  fig.show(d, avail);
  setTimeout(sweep, 1000);
}

// Libera figuras que saíram do documento.
function sweep() {
  for (const fig of live) if (!fig.el.isConnected) fig.dispose();
}

// O tema muda as cores: refaz as cenas.
const retheme = () => { for (const fig of live) if (fig.d) fig.show(fig.d, fig.avail); };
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', retheme);
new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// ------------------------------------------------------------------ cores

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function color(c) {
  if (typeof c === 'number') return new THREE.Color(cssVar(`--s${(c - 1) % 6}`));
  if (c === 'ink' || c === undefined || c === null) return new THREE.Color(c === 'ink' ? cssVar('--ink') : cssVar('--s0'));
  return new THREE.Color(c);
}

// Escala de cores pela altura (viridis, 5 paradas).
const VIRIDIS = [[0.267, 0.005, 0.329], [0.229, 0.322, 0.546], [0.128, 0.567, 0.551], [0.369, 0.789, 0.383], [0.993, 0.906, 0.144]];
function viridis(s) {
  const x = Math.min(1, Math.max(0, s)) * (VIRIDIS.length - 1);
  const k = Math.min(VIRIDIS.length - 2, Math.floor(x)), f = x - k;
  return VIRIDIS[k].map((a, i) => a + (VIRIDIS[k + 1][i] - a) * f);
}

// ------------------------------------------------------------------ caixa

// Intervalo robusto (quantis) para alturas de gráficos com polos.
function robust(vs) {
  vs = vs.filter(Number.isFinite).sort((a, b) => a - b);
  if (!vs.length) return null;
  const q = (p) => vs[Math.round(p * (vs.length - 1))];
  let lo = vs[0], hi = vs[vs.length - 1];
  const core = q(0.98) - q(0.02);
  if (core > 0 && hi - lo > 20 * core) { lo = q(0.02) - core * 0.5; hi = q(0.98) + core * 0.5; }
  return [lo, hi];
}

function bounds(leaves, o) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const dataZ = [];
  const add = (p, data) => {
    if (!p || !p.every(Number.isFinite)) return;
    for (let k = 0; k < 3; k++) {
      if (k === 2 && data) { dataZ.push(p[2]); continue; }
      lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]);
    }
  };
  for (const it of leaves) {
    switch (it.g) {
      case 'sphere': add(it.c.map((x) => x - it.r)); add(it.c.map((x) => x + it.r)); break;
      case 'plane': add(it.p); break;
      case 'text': add(it.p); break;
      case 'mesh':
        for (let i = 0; i < it.pos.length; i += 3) add([it.pos[i], it.pos[i + 1], it.pos[i + 2]], it.data);
        break;
      default: for (const p of it.pts) add(p);
    }
  }
  const z = robust(dataZ);
  if (z) { lo[2] = Math.min(lo[2], z[0]); hi[2] = Math.max(hi[2], z[1]); }
  const lims = [o.xlim, o.ylim, o.zlim];
  const span = Math.max(1e-9, ...[0, 1, 2].map((k) => (hi[k] > lo[k] ? hi[k] - lo[k] : 0)));
  const box = [0, 1, 2].map((k) => {
    if (lims[k]) return [...lims[k]];
    if (!(hi[k] >= lo[k])) return [-1, 1];
    if (hi[k] - lo[k] < 1e-9 * span) { const w = span > 1e-9 ? span / 2 : 1; return [lo[k] - w, hi[k] + w]; }
    return [lo[k], hi[k]];
  });
  return box;
}

// ------------------------------------------------------------------ figura

class Figure {
  constructor(figs, key) {
    this.figs = figs;
    this.key = key;
    this.view = { theta: -1.07, phi: 0.95, zoom: 1 };
    this.el = document.createElement('div');
    this.el.className = 'plot3d';
    this.el.tabIndex = 0;
    this.overlay = document.createElement('div');
    this.overlay.className = 'overlay3d';
    this.el.append(this.overlay);
    this.disposed = false;
    live.add(this);
  }

  show(d, avail) {
    this.d = d;
    this.avail = avail;
    const o = d.opts ?? {};
    this.width = Math.round(o.width ?? avail);
    this.height = Math.round(o.height ?? Math.min(520, Math.max(260, this.width * 0.72)));
    this.el.style.width = `${this.width}px`;
    this.el.style.height = `${this.height}px`;
    if (!THREE) {
      this.overlay.innerHTML = `<div class="loading3d">${t('loading3d')}</div>`;
      loadThree().then(() => { if (!this.disposed && this.d) this.show(this.d, this.avail); },
        () => { this.overlay.innerHTML = `<div class="loading3d">${t('load3dFailed')}</div>`; });
      return;
    }
    if (!this.renderer) this.init();
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    this.build(d);
    this.render();
  }

  init() {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.localClippingEnabled = true;
    this.renderer = r;
    this.el.prepend(r.domElement);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.01, 1000);
    this.camera.up.set(0, 0, 1);
    this.controls();
  }

  // Arrastar gira; a roda aproxima quando a figura tem foco (clique nela);
  // duplo clique volta à vista inicial; setas giram.
  controls() {
    const el = this.renderer.domElement;
    let last = null;
    el.addEventListener('pointerdown', (ev) => {
      last = [ev.clientX, ev.clientY];
      el.setPointerCapture(ev.pointerId);
      this.el.focus({ preventScroll: true });
    });
    el.addEventListener('pointermove', (ev) => {
      if (!last) return;
      this.turn((ev.clientX - last[0]) * 0.01, (ev.clientY - last[1]) * 0.01);
      last = [ev.clientX, ev.clientY];
    });
    const up = () => { last = null; };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (ev) => {
      if (document.activeElement !== this.el) return;
      ev.preventDefault();
      this.view.zoom = Math.min(6, Math.max(0.25, this.view.zoom * Math.exp(ev.deltaY * 0.001)));
      this.render();
    }, { passive: false });
    el.addEventListener('dblclick', () => { this.view = { theta: -1.07, phi: 0.95, zoom: 1 }; this.render(); });
    this.el.addEventListener('keydown', (ev) => {
      const k = { ArrowLeft: [0.1, 0], ArrowRight: [-0.1, 0], ArrowUp: [0, 0.1], ArrowDown: [0, -0.1] }[ev.key];
      if (!k) return;
      ev.preventDefault();
      this.turn(...k);
    });
  }

  turn(dt, dp) {
    this.view.theta -= dt;
    this.view.phi = Math.min(Math.PI - 0.02, Math.max(0.02, this.view.phi - dp));
    this.render();
  }

  // Coordenadas dos dados → cena: centro da caixa na origem; "equal" usa a
  // mesma escala nos três eixos, "auto" leva x e y a 2 e z a 1,4.
  build(d) {
    const o = d.opts ?? {};
    if (this.scene) this.free();
    const scene = new THREE.Scene();
    this.scene = scene;
    const leaves = flatten(d.items, {}, []);
    const box = bounds(leaves, o);
    const span = box.map(([a, b]) => b - a);
    const c = box.map(([a, b]) => (a + b) / 2);
    const s = o.aspect === 'auto' ? [2 / span[0], 2 / span[1], 1.4 / span[2]] : span.map(() => 2 / Math.max(...span));
    const S = (p) => new THREE.Vector3((p[0] - c[0]) * s[0], (p[1] - c[1]) * s[1], (p[2] - c[2]) * s[2]);
    const h = span.map((w, k) => (w * s[k]) / 2);
    this.radius = Math.hypot(...h);
    this.box = box;
    this.h = h;
    const eps = 1e-3 * this.radius;
    const clip = [0, 1, 2].flatMap((k) => [1, -1].map((sg) => {
      const n = new THREE.Vector3(); n.setComponent(k, sg);
      return new THREE.Plane(n, h[k] + eps);
    }));
    const tube = (w) => (w ?? 1.5) * 0.004 * this.radius;
    const mat = (a, opts = {}) => {
      const op = a.opacity ?? opts.opacity ?? 1;
      return new THREE.MeshPhongMaterial({
        color: color(a.color ?? 1), side: THREE.DoubleSide, shininess: 40, clippingPlanes: clip,
        transparent: op < 1, opacity: op, depthWrite: op >= 1, ...opts.extra,
      });
    };
    const far = 8 * this.radius;
    this.labels = [];
    for (const it of leaves) {
      const a = it.attrs;
      switch (it.g) {
        case 'points': {
          const g = new THREE.BufferGeometry().setFromPoints(it.pts.filter(Boolean).map(S));
          const m = new THREE.PointsMaterial({ color: color(a.color ?? 1), size: (a.size ?? 3) * 2, sizeAttenuation: false,
            map: dotTexture(), alphaTest: 0.5, transparent: true, opacity: a.opacity ?? 1, clippingPlanes: clip });
          scene.add(new THREE.Points(g, m));
          break;
        }
        case 'line': case 'arrow': {
          const runs = [[]];
          for (const p of it.pts) if (p) runs[runs.length - 1].push(S(p)); else runs.push([]);
          if (it.closed && it.pts[0] && it.pts.at(-1)) runs[runs.length - 1].push(S(it.pts[0]));
          for (const r of runs) if (r.length >= 2) scene.add(new THREE.Mesh(polyTube(r, tube(a.width)), mat(a)));
          if (it.g === 'arrow') scene.add(arrowHead(S(it.pts[0]), S(it.pts[1]), tube(a.width), mat(a)));
          break;
        }
        case 'infline': case 'ray': {
          const p = S(it.pts[0]), q = S(it.pts[1]);
          const dir = q.clone().sub(p).normalize();
          const a0 = it.g === 'ray' ? p : p.clone().addScaledVector(dir, -far);
          scene.add(new THREE.Mesh(polyTube([a0, p.clone().addScaledVector(dir, far)], tube(a.width)), mat(a)));
          break;
        }
        case 'plane': {
          // Normal na cena: inversa transposta da escala.
          const n = new THREE.Vector3(it.n[0] / s[0], it.n[1] / s[1], it.n[2] / s[2]).normalize();
          const p = S(it.p);
          const g = new THREE.PlaneGeometry(2 * far, 2 * far);
          const m = new THREE.Mesh(g, mat({ color: 2, ...a }, { opacity: 0.5 }));
          m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
          m.position.copy(n.clone().multiplyScalar(n.dot(p)));
          scene.add(m);
          break;
        }
        case 'sphere': {
          const m = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), mat(a));
          m.scale.set(it.r * s[0], it.r * s[1], it.r * s[2]);
          m.position.copy(S(it.c));
          scene.add(m);
          break;
        }
        case 'mesh': scene.add(...meshObjects(it, S, mat, clip, box[2])); break;
        case 'text': this.labels.push({ p: S(it.p), s: it.s, cls: 'text3d', color: a.color, pos: it.pos }); break;
      }
    }
    if (o.box !== false) scene.add(boxLines(h, clip));
    if (o.axes !== false) this.axisLabels(box, h);
    if (o.title) this.labels.push({ title: o.title });
    scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    this.light = new THREE.DirectionalLight(0xffffff, 1.6);
    scene.add(this.light);
  }

  // Marcas nas arestas da caixa: x e y na base, z numa aresta vertical.
  axisLabels(box, h) {
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const edges = [
      (u) => V(u, -h[1] * 1.12, -h[2]), (u) => V(h[0] * 1.12, u, -h[2]), (u) => V(-h[0] * 1.08, -h[1] * 1.08, u),
    ];
    for (let k = 0; k < 3; k++) {
      const [a, b] = box[k];
      for (const v of ticks(a, b, k === 2 ? 4 : 5)) {
        const u = ((v - a) / (b - a) - 0.5) * 2 * h[k];
        this.labels.push({ p: edges[k](u), s: fmt(v), cls: 'tick3d' });
      }
      this.labels.push({ p: edges[k](0).multiplyScalar(1.12).setComponent(k, k === 2 ? h[2] * 1.15 : 0), s: 'xyz'[k], cls: 'axis3d' });
    }
  }

  render() {
    if (!this.renderer || !this.scene) return;
    const { theta, phi, zoom } = this.view;
    const cam = this.camera;
    const dist = (zoom * this.radius) / Math.sin((cam.fov * Math.PI) / 360);
    cam.position.set(dist * Math.sin(phi) * Math.cos(theta), dist * Math.sin(phi) * Math.sin(theta), dist * Math.cos(phi));
    cam.lookAt(0, 0, 0);
    cam.near = dist / 100;
    cam.far = dist * 10;
    cam.updateProjectionMatrix();
    this.light.position.copy(cam.position).add(new THREE.Vector3(0, 0, dist * 0.5));
    this.renderer.render(this.scene, cam);
    this.placeLabels();
  }

  placeLabels() {
    const html = [];
    for (const l of this.labels) {
      if (l.title) { html.push(`<div class="title3d">${esc(l.title)}</div>`); continue; }
      const v = l.p.clone().project(this.camera);
      if (v.z > 1) continue;
      const x = ((v.x + 1) / 2) * this.width, y = ((1 - v.y) / 2) * this.height;
      const col = l.color === undefined ? '' : `color:${typeof l.color === 'number' ? `var(--s${(l.color - 1) % 6})` : l.color === 'ink' ? 'var(--ink)' : l.color};`;
      html.push(`<span class="${l.cls}" style="${col}left:${x.toFixed(1)}px;top:${y.toFixed(1)}px">${esc(l.s)}</span>`);
    }
    this.overlay.innerHTML = html.join('');
  }

  free() {
    this.scene.traverse((ob) => {
      ob.geometry?.dispose();
      const ms = Array.isArray(ob.material) ? ob.material : ob.material ? [ob.material] : [];
      for (const m of ms) m.dispose();
    });
    this.scene = null;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    live.delete(this);
    if (this.figs.get(this.key) === this) this.figs.delete(this.key);
    if (this.scene) this.free();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
  }
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Tubo ao longo de uma poligonal (as retas do WebGL têm 1 px).
function polyTube(pts, r) {
  const path = new THREE.CurvePath();
  for (let k = 0; k + 1 < pts.length; k++) if (pts[k].distanceTo(pts[k + 1]) > 0) path.add(new THREE.LineCurve3(pts[k], pts[k + 1]));
  if (!path.curves.length) return new THREE.SphereGeometry(r, 8, 6).translate(pts[0].x, pts[0].y, pts[0].z);
  return new THREE.TubeGeometry(path, Math.min(4000, path.curves.length), r, 8, false);
}

function arrowHead(p, q, r, m) {
  const dir = q.clone().sub(p);
  const len = Math.min(dir.length() * 0.3, r * 12);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 3.5, len, 16), m);
  dir.normalize();
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  cone.position.copy(q).addScaledVector(dir, -len / 2);
  return cone;
}

let dot = null;
function dotTexture() {
  if (dot) return dot;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(32, 32, 30, 0, 2 * Math.PI);
  g.fill();
  dot = new THREE.CanvasTexture(cv);
  return dot;
}

// Superfície: triângulos nas células da grade com os 4 vértices definidos,
// normais pela média das faces, cor pela altura dentro da caixa [z0, z1]
// (colormap) e linhas da malha (mesh, até ~24 em cada direção).
function meshObjects(it, S, mat, clip, [z0, z1]) {
  const { nu, nv, pos } = it;
  const a = it.attrs;
  const n = (nu + 1) * (nv + 1);
  const P = new Float32Array(n * 3);
  const ok = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    const p = [pos[3 * k], pos[3 * k + 1], pos[3 * k + 2]];
    if (!p.every(Number.isFinite)) continue;
    ok[k] = 1;
    S(p).toArray(P, 3 * k);
  }
  const idx = [];
  const at = (i, j) => i * (nv + 1) + j;
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const q = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
      if (q.every((k) => ok[k])) idx.push(q[0], q[1], q[2], q[0], q[2], q[3]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const extra = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
  if (a.colormap === 'z') {
    const C = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) if (ok[k]) C.set(viridis(z1 > z0 ? (pos[3 * k + 2] - z0) / (z1 - z0) : 0.5), 3 * k);
    g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    extra.vertexColors = true;
  }
  const m = mat(a, { extra });
  if (a.colormap === 'z') m.color.set(0xffffff);
  const out = [new THREE.Mesh(g, m)];
  if (a.mesh !== false) {
    const L = [];
    const every = (len) => Math.max(1, Math.round(len / 24));
    const su = every(nu), sv = every(nv);
    const seg = (k1, k2) => { if (ok[k1] && ok[k2]) L.push(...P.subarray(3 * k1, 3 * k1 + 3), ...P.subarray(3 * k2, 3 * k2 + 3)); };
    for (let i = 0; i <= nu; i += su) for (let j = 0; j < nv; j++) seg(at(i, j), at(i, j + 1));
    for (let j = 0; j <= nv; j += sv) for (let i = 0; i < nu; i++) seg(at(i, j), at(i + 1, j));
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(L), 3));
    out.push(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: color('ink'), transparent: true, opacity: 0.22, clippingPlanes: clip })));
  }
  return out;
}

function boxLines(h, clip) {
  const [x, y, z] = h;
  const c = [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]];
  const E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(E.flatMap(([a, b]) => [...c[a], ...c[b]])), 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: new THREE.Color(cssVar('--muted')), transparent: true, opacity: 0.5 }));
}
