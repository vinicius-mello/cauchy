// Aplicação principal (thread da UI): células, editor, comunicação com o
// worker, persistência e painel de referência.

import { render, ringName, esc } from './render.js';
import { renderGraphics, handleKey } from './plot.js';
import { highlight, symbolAt } from './highlight.js';
import { EXAMPLES, pick } from './examples.js';
import { t, setLang, getLang, detectLang, applyStatic, translateError, SYNTAX_CODE, SYNTAX_NOTES } from './i18n.js';
import { REF, CATEGORIES, ALIASES, flintDocUrl } from './reference.js';

const STORE_KEY = 'cauchy.notebook.v1';
const AUTORUN_MS = 500;
const SLOW_MS = 300;

const $ = (sel, root = document) => root.querySelector(sel);

const state = {
  title: '',
  sigs: {},
  refTab: 'functions',
  cells: [], // {id, src, widgets, el, result, dirty}
  builtins: new Set(),
  docs: [],
  worker: null,
  ready: false,
  running: null,
  runningSince: 0,
  pending: [],
  busy: false,
};

let nextId = 1;
const newId = () => `c${Date.now().toString(36)}${(nextId++).toString(36)}`;

// --------------------------------------------------------------- worker

function wasmUrl() {
  return new URL('cauchy.wasm', location.href).href;
}

function startWorker(skip = []) {
  state.ready = false;
  state.busy = true;
  setStatus('loading', 'busy');
  const code = document.getElementById('worker-src').textContent;
  const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  const w = new Worker(url, { type: 'module', name: 'cauchy' });
  state.worker = w;
  w.onmessage = (ev) => onWorker(ev.data);
  w.onerror = (ev) => {
    setStatus('worker-error', 'error', false, ev.message ?? String(ev));
  };
  w.postMessage({ type: 'init', wasmUrl: wasmUrl() });
  // Carrega todas as células assim que o worker estiver pronto.
  state.pending = [{ type: 'update', changes: state.cells.map(cellChange), skip }];
  for (const c of state.cells) if (!skip.includes(c.id)) markStale(c);
}

function cellChange(c) {
  return { id: c.id, src: c.src, widgets: c.widgets };
}

function send(msg) {
  if (!state.ready) {
    state.pending.push(msg);
    return;
  }
  state.busy = true;
  state.worker.postMessage(msg);
}

// Durante o arraste de um slider, só o valor mais recente importa: se o
// worker está ocupado, guarda-o e envia quando a avaliação corrente terminar.
const widgetQueue = new Map();

function sendWidget(msg) {
  if (state.ready && !state.busy) send(msg);
  else widgetQueue.set(`${msg.id}:${msg.index}`, msg);
}

function flushWidgets() {
  if (!widgetQueue.size || state.busy || !state.ready) return;
  const msgs = [...widgetQueue.values()];
  widgetQueue.clear();
  for (const m of msgs) send(m);
}

function onWorker(msg) {
  switch (msg.type) {
    case 'ready':
      state.ready = true;
      state.docs = msg.docs;
      state.builtins = new Set(msg.docs.map(([n]) => n));
      state.sigs = msg.sigs ?? {};
      $('#version').textContent = msg.version;
      buildReference();
      for (const c of state.cells) refreshHighlight(c);
      for (const m of state.pending.splice(0)) send(m);
      if (!state.pending.length && !state.busy) setStatus('ready', 'ok');
      break;
    case 'start': {
      state.running = msg.id;
      state.runningSince = performance.now();
      const c = cellById(msg.id);
      if (c) {
        c.el.classList.add('running');
        setTimeout(() => {
          if (state.running === msg.id) {
            c.el.classList.add('slow');
            setStatus('computing', 'busy', true);
          }
        }, SLOW_MS);
      }
      break;
    }
    case 'result': {
      const c = cellById(msg.id);
      state.running = null;
      if (c) showResult(c, msg);
      if (msg.fatal) restartWorker([msg.id]);
      break;
    }
    case 'done':
      state.busy = false;
      setStatus('ready', 'ok');
      flushWidgets();
      state.live = msg.live;
      $('#live').textContent = t('objects', msg.live);
      break;
    case 'fatal':
      setStatus('fatal-restart', 'error');
      console.error(msg.message);
      restartWorker(state.running ? [state.running] : []);
      break;
  }
}

function restartWorker(skip) {
  state.worker?.terminate();
  state.running = null;
  for (const c of state.cells) c.el.classList.remove('running', 'slow');
  startWorker(skip);
}

function interrupt() {
  if (!state.running && !state.busy) return;
  const id = state.running;
  restartWorker(id ? [id] : []);
}

// --------------------------------------------------------------- células

function cellById(id) {
  return state.cells.find((c) => c.id === id);
}

function createCell(src = '', after = null, focus = false) {
  const c = { id: newId(), src, widgets: [], result: null, el: null, timer: null, sentSrc: null };
  const idx = after ? state.cells.indexOf(after) + 1 : state.cells.length;
  state.cells.splice(idx, 0, c);
  c.el = buildCellEl(c);
  const list = $('#cells');
  const nextEl = state.cells[idx + 1]?.el ?? null;
  list.insertBefore(c.el, nextEl);
  refreshHighlight(c);
  autosize(c);
  if (focus) $('textarea', c.el).focus();
  return c;
}

function buildCellEl(c) {
  const el = document.createElement('section');
  el.className = 'cell';
  el.dataset.id = c.id;
  el.innerHTML = `
    <div class="gutter"><span class="dot" title=""></span></div>
    <div class="body">
      <div class="editor">
        <pre class="hl" aria-hidden="true"></pre>
        <textarea spellcheck="false" autocapitalize="off" autocomplete="off" rows="1" data-i18n-aria="cell.code"></textarea>
      </div>
      <div class="out" aria-live="polite"></div>
    </div>
    <div class="tools">
      <button data-act="run" data-i18n-title="cell.run">▶</button>
      <button data-act="up" data-i18n-title="cell.up">↑</button>
      <button data-act="down" data-i18n-title="cell.down">↓</button>
      <button data-act="add" data-i18n-title="cell.add">+</button>
      <button data-act="del" data-i18n-title="cell.del">✕</button>
    </div>`;
  applyStatic(el);
  const ta = $('textarea', el);
  ta.value = c.src;
  ta.addEventListener('input', (ev) => {
    if (symbolize(ta, ev)) return;
    c.src = ta.value;
    refreshHighlight(c);
    autosize(c);
    markStale(c);
    save();
    if ($('#autorun').checked) {
      clearTimeout(c.timer);
      c.timer = setTimeout(() => evalCell(c), AUTORUN_MS);
    }
  });
  ta.addEventListener('keydown', (ev) => onKey(ev, c));
  ta.addEventListener('scroll', () => { $('.hl', el).scrollTop = ta.scrollTop; });
  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-act]');
    if (b) cellAction(c, b.dataset.act);
    const ex = ev.target.closest('button.expand');
    if (ex) {
      const span = ex.parentElement.querySelector('.trunc');
      span.textContent = ex.dataset.full;
      ex.remove();
    }
  });
  return el;
}

function cellAction(c, act) {
  const i = state.cells.indexOf(c);
  switch (act) {
    case 'run': evalCell(c); break;
    case 'add': createCell('', c, true); break;
    case 'del': deleteCell(c); break;
    case 'up':
      if (i > 0) {
        state.cells.splice(i, 1);
        state.cells.splice(i - 1, 0, c);
        c.el.parentNode.insertBefore(c.el, state.cells[i].el);
        save();
      }
      break;
    case 'down':
      if (i < state.cells.length - 1) {
        state.cells.splice(i, 1);
        state.cells.splice(i + 1, 0, c);
        c.el.parentNode.insertBefore(state.cells[i].el, c.el);
        save();
      }
      break;
  }
}

function deleteCell(c) {
  const i = state.cells.indexOf(c);
  state.cells.splice(i, 1);
  c.el.remove();
  send({ type: 'update', changes: [{ id: c.id, src: null }] });
  save();
  const next = state.cells[i] ?? state.cells[i - 1];
  if (next) $('textarea', next.el).focus();
  if (!state.cells.length) createCell('', null, true);
}

function onKey(ev, c) {
  const ta = ev.target;
  if (ev.key === 'Enter' && ev.shiftKey) {
    ev.preventDefault();
    evalCell(c);
    const i = state.cells.indexOf(c);
    const next = state.cells[i + 1] ?? createCell('', c);
    $('textarea', next.el).focus();
  } else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
    ev.preventDefault();
    evalCell(c);
  } else if (ev.key === 'Enter' && ev.altKey) {
    ev.preventDefault();
    evalCell(c);
    createCell('', c, true);
  } else if (ev.key === 'Tab' && !ev.shiftKey) {
    ev.preventDefault();
    const s = ta.selectionStart;
    ta.setRangeText('  ', s, ta.selectionEnd, 'end');
    ta.dispatchEvent(new Event('input'));
  } else if (ev.key === 'ArrowUp' && ta.selectionStart === 0 && !ev.shiftKey) {
    const prev = state.cells[state.cells.indexOf(c) - 1];
    if (prev) { ev.preventDefault(); const t = $('textarea', prev.el); t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
  } else if (ev.key === 'ArrowDown' && ta.selectionEnd === ta.value.length && !ev.shiftKey) {
    const next = state.cells[state.cells.indexOf(c) + 1];
    if (next) { ev.preventDefault(); const t = $('textarea', next.el); t.focus(); t.setSelectionRange(0, 0); }
  } else if (ev.key === 'Escape') {
    ta.blur();
  } else if (ev.key === '.' && (ev.ctrlKey || ev.metaKey)) {
    ev.preventDefault();
    interrupt();
  }
}

function evalCell(c) {
  clearTimeout(c.timer);
  c.sentSrc = c.src;
  send({ type: 'update', changes: [cellChange(c)] });
}

function evalAll() {
  for (const c of state.cells) c.sentSrc = c.src;
  send({ type: 'update', changes: state.cells.map(cellChange) });
}

function markStale(c) {
  if (c.src !== c.sentSrc) c.el.classList.add('stale');
}

function autosize(c) {
  const ta = $('textarea', c.el);
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}

function refreshHighlight(c) {
  const err = c.result?.status === 'error' && c.result.error.pos !== undefined && c.src === c.sentSrc ? c.result.error : null;
  $('.hl', c.el).innerHTML = highlight(c.src, state.builtins, err);
}

// --------------------------------------------------------------- saída

// Chave que identifica um widget: se não muda, o controle é mantido no DOM
// (recriá-lo durante o arraste interromperia o gesto).
function widgetKey(d) {
  return d && d.t === 'widget' ? JSON.stringify([d.kind, d.spec]) : null;
}

function showResult(c, res) {
  const key = res.status === 'ok' ? widgetKey(res.display) : null;
  if (key && key === c.widgetKey && c.result?.status === 'ok' && !c.relang) {
    c.result = res;
    c.el.classList.remove('running', 'slow', 'stale');
    const outv = $('.widget output', c.el);
    const v = res.display.value;
    if (outv && document.activeElement?.type !== 'range') outv.textContent = v && typeof v === 'object' ? v.text : v;
    // Ponto de controle: campos x e y acompanham o valor (se não estão em edição).
    if (v && typeof v === 'object' && !Array.isArray(v.at[0])) {
      c.el.querySelectorAll('.widget input.coord').forEach((inp, k) => {
        if (document.activeElement !== inp) inp.value = fmtCoord(v.at[k]);
      });
    }
    return;
  }
  c.widgetKey = key;
  c.result = res;
  const el = c.el;
  el.classList.remove('running', 'slow', 'stale', 'ok', 'error', 'upstream');
  const out = $('.out', el);
  const dot = $('.dot', el);
  if (res.status === 'error') {
    el.classList.add('error');
    if (res.upstream) el.classList.add('upstream');
    out.innerHTML = `<div class="err">${esc(translateError(res.error.message))}</div>`;
    dot.title = t('error');
  } else {
    el.classList.add('ok');
    dot.title = res.ms !== undefined ? `${res.ms < 1 ? '<1' : Math.round(res.ms)} ms` : '';
    if (!res.display) {
      out.innerHTML = '';
    } else {
      const { html, slots } = render(res.display);
      const label = res.label && res.display.t !== 'fn' && res.display.t !== 'widget' ? `<span class="lbl">${esc(res.label)} =</span>` : '';
      out.innerHTML = `<div class="val">${label}<div class="math">${html}</div></div>`;
      out.querySelectorAll('.slot').forEach((slot) => mountSlot(c, slot, slots[+slot.dataset.slot], res));
    }
    if (res.ms > 50) out.insertAdjacentHTML('beforeend', `<div class="ms">${Math.round(res.ms)} ms</div>`);
  }
  refreshHighlight(c);
}

function mountSlot(c, slot, d, res) {
  if (d.t === 'graphics') {
    const w = Math.max(300, Math.min(760, ($('#cells').clientWidth || 700) - 60));
    // Depois de arrastar um ponto, a janela fica fixa até a célula ser editada.
    const view = c.view && c.viewSrc === c.src ? c.view : null;
    const svg = renderGraphics(d, w, { view, interact: interactFor(c) });
    slot.replaceWith(svg);
    if (drag && drag.cell === c) {
      drag.svg = svg;
      svg.querySelector(`[data-h="${drag.key}"]`)?.classList.add('active');
    }
    if (c.focusKey) {
      const g = svg.querySelector(`[data-h="${c.focusKey}"]`);
      if (g) g.focus({ preventScroll: true });
    }
    return;
  }
  if (d.t === 'widget') {
    const wrap = document.createElement('div');
    wrap.className = 'widget';
    const label = d.spec.label ?? res.label ?? '';
    const idx = d.spec.index;
    const sendValue = (v) => {
      c.widgets[idx] = { kind: d.kind, value: v };
      save();
      sendWidget({ type: 'widget', id: c.id, index: idx, value: v });
    };
    if (d.kind === 'slider') {
      wrap.innerHTML = `<label><span class="wl">${esc(label)}</span><input type="range" min="${d.spec.min}" max="${d.spec.max}" step="${d.spec.step}" value="${d.value}"><output>${esc(d.value)}</output></label>`;
      const input = $('input', wrap);
      const outv = $('output', wrap);
      input.addEventListener('input', () => {
        outv.textContent = input.value;
        sendValue(Number(input.value));
      });
    } else if (d.kind === 'checkbox') {
      wrap.innerHTML = `<label><input type="checkbox" ${d.value ? 'checked' : ''}><span class="wl">${esc(label)}</span></label>`;
      $('input', wrap).addEventListener('change', (ev) => sendValue(ev.target.checked));
    } else if (d.kind === 'text' || d.kind === 'number') {
      wrap.innerHTML = `<label><span class="wl">${esc(label)}</span><input type="text" value="${esc(d.value)}"></label>`;
      $('input', wrap).addEventListener('change', (ev) => sendValue(ev.target.value));
    } else if (d.kind === 'handle') {
      const [x, y] = d.value.at;
      wrap.innerHTML = `<label><span class="wl">${esc(label)}</span><output>${esc(d.value.text)}</output></label>` +
        `<label class="xy">x <input type="text" class="coord" size="9" value="${esc(fmtCoord(x))}">` +
        ` y <input type="text" class="coord" size="9" value="${esc(fmtCoord(y))}"></label>`;
      const [ix, iy] = wrap.querySelectorAll('input');
      const commit = () => sendValue({ from: d.spec.from, at: [ix.value.trim(), iy.value.trim()] });
      ix.addEventListener('change', commit);
      iy.addEventListener('change', commit);
    } else if (d.kind === 'handles') {
      wrap.innerHTML = `<label><span class="wl">${esc(label)}</span><output>${esc(d.value.text)}</output></label>`;
    } else if (d.kind === 'select') {
      const opts = d.spec.options.map((o, i) => `<option value="${i}" ${i === d.value ? 'selected' : ''}>${esc(o)}</option>`).join('');
      wrap.innerHTML = `<label><span class="wl">${esc(label)}</span><select>${opts}</select></label>`;
      $('select', wrap).addEventListener('change', (ev) => sendValue(Number(ev.target.value)));
    }
    slot.replaceWith(wrap);
  }
}

// --------------------------------------------------------- pontos de controle
// Arrastar um ponto envia o novo valor à célula dona do handle (como um
// slider); a janela do gráfico fica fixa para os eixos não se moverem sob o
// cursor. O marcador anda na hora; o resto do gráfico segue o worker.
let drag = null; // {cell, h, key, svg}

const fmtCoord = (x) => String(+(+x).toPrecision(10));

function viewOf(svg) {
  const { x0, x1, y0, y1, width, height } = svg.cauchyView;
  return { x0, x1, y0, y1, width, height };
}

function freeze(c, svg) {
  if (!(c.view && c.viewSrc === c.src)) {
    c.view = viewOf(svg);
    c.viewSrc = c.src;
  }
}

function toData(svg, ev) {
  const v = svg.cauchyView;
  const rect = svg.getBoundingClientRect();
  const px = ((ev.clientX - rect.left) / rect.width) * v.width;
  const py = ((ev.clientY - rect.top) / rect.height) * v.height;
  const x = v.x0 + ((px - v.m.l) / v.W) * (v.x1 - v.x0);
  const y = v.y1 - ((py - v.m.t) / v.H) * (v.y1 - v.y0);
  return [Math.min(v.x1, Math.max(v.x0, x)), Math.min(v.y1, Math.max(v.y0, y))];
}

// Decimal com a resolução de um pixel da janela.
function decimal(svg, x) {
  const v = svg.cauchyView;
  const d = Math.max(0, Math.min(15, Math.ceil(-Math.log10((v.x1 - v.x0) / v.W))));
  const s = x.toFixed(d);
  return /^-0(\.0*)?$/.test(s) ? s.slice(1) : s;
}

function sendHandle(h, value) {
  const owner = cellById(h.id);
  if (owner) {
    owner.widgets[h.index] = { kind: h.entries ? 'handles' : 'handle', value };
    save();
  }
  sendWidget({ type: 'widget', id: h.id, index: h.index, value });
}

function moveHandle(h, xy, svg) {
  const at = xy.map((v) => decimal(svg, v));
  if (h.entries) {
    const pts = [...h.entries];
    pts[h.sub] = at;
    sendHandle(h, { from: h.from, pts });
  } else sendHandle(h, { from: h.from, at });
  const v = svg.cauchyView;
  const g = svg.querySelector(`[data-h="${handleKey(h)}"]`);
  const px = v.m.l + ((xy[0] - v.x0) / (v.x1 - v.x0)) * v.W;
  const py = v.m.t + v.H - ((xy[1] - v.y0) / (v.y1 - v.y0)) * v.H;
  g?.setAttribute('transform', `translate(${px.toFixed(2)},${py.toFixed(2)})`);
}

function interactFor(c) {
  return {
    down(h, ev, svg) {
      freeze(c, svg);
      c.focusKey = null;
      drag = { cell: c, h, key: handleKey(h), svg };
      svg.querySelector(`[data-h="${drag.key}"]`)?.classList.add('active');
      document.body.classList.add('dragging');
      const move = (e) => {
        if (drag) moveHandle(drag.h, toData(drag.svg, e), drag.svg);
      };
      const up = () => {
        drag?.svg.querySelector('.handle.active')?.classList.remove('active');
        drag = null;
        document.body.classList.remove('dragging');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    },
    nudge(h, p, [dx, dy], big, svg) {
      freeze(c, svg);
      c.focusKey = handleKey(h);
      const v = svg.cauchyView;
      const step = Math.max(((v.x1 - v.x0) / v.W) * (big ? 10 : 1), h.snap ?? 0);
      moveHandle(h, [p[0] + dx * step, p[1] + dy * step], svg);
    },
    add(leaf, xy, svg) {
      const meta = leaf.dragList;
      if (meta.max !== null && meta.entries.length >= meta.max) return;
      freeze(c, svg);
      // Numa poligonal, o ponto novo entra no segmento mais próximo.
      let pos = meta.entries.length;
      if (leaf.g === 'line' && leaf.pts.length >= 2) {
        const n = leaf.pts.length;
        let best = Infinity;
        for (let i = 0; i < (leaf.closed ? n : n - 1); i++) {
          const [a, b] = [leaf.pts[i], leaf.pts[(i + 1) % n]];
          const [ux, uy] = [b[0] - a[0], b[1] - a[1]];
          const t = Math.max(0, Math.min(1, ((xy[0] - a[0]) * ux + (xy[1] - a[1]) * uy) / (ux * ux + uy * uy || 1)));
          const dd = Math.hypot(a[0] + t * ux - xy[0], a[1] + t * uy - xy[1]);
          // Além das pontas de uma poligonal aberta, o ponto estende a linha.
          if (dd < best) [best, pos] = [dd, !leaf.closed && i === 0 && t === 0 ? 0 : !leaf.closed && i === n - 2 && t === 1 ? n : i + 1];
        }
      }
      const pts = [...meta.entries];
      pts.splice(pos, 0, xy.map((v) => decimal(svg, v)));
      sendHandle(meta, { from: meta.from, pts });
    },
    remove(h, svg) {
      if (h.entries.length <= (h.min ?? 0)) return;
      freeze(c, svg);
      const pts = [...h.entries];
      pts.splice(h.sub, 1);
      sendHandle(h, { from: h.from, pts });
    },
  };
}

document.addEventListener('pointerdown', (ev) => {
  for (const c of state.cells) if (c.focusKey && !ev.target.closest?.('.handle')) c.focusKey = null;
});

// --------------------------------------------------------------- status

function setStatus(key, kind, cancellable = false, arg) {
  const s = $('#status');
  s.className = `status ${kind}`;
  state.status = [key, kind, cancellable, arg];
  $('#status-text').textContent = t(key, arg);
  $('#stop').hidden = !cancellable;
}

// --------------------------------------------------------------- persistência

function serialize() {
  return { title: state.title, cells: state.cells.map((c) => ({ src: c.src, widgets: c.widgets })) };
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(serialize()));
  } catch {
    // armazenamento indisponível: segue sem salvar
  }
}

function load(nb) {
  for (const c of state.cells) {
    c.el.remove();
    send({ type: 'update', changes: [{ id: c.id, src: null }] });
  }
  state.cells = [];
  state.title = nb.title ? pick(nb.title, getLang()) : '';
  $('#title').value = state.title;
  for (const cell of nb.cells ?? []) {
    const c = createCell(typeof cell === 'string' || !('src' in cell) ? pick(cell, getLang()) : cell.src);
    c.widgets = cell.widgets ?? [];
  }
  if (!state.cells.length) createCell('');
  save();
  evalAll();
}

async function compress(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (const b of buf) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function decompress(b64) {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const buf = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

async function share() {
  const data = await compress(JSON.stringify(serialize()));
  const url = `${location.origin}${location.pathname}#nb=${data}`;
  history.replaceState(null, '', url);
  try {
    await navigator.clipboard.writeText(url);
    toast(t('link-copied'));
  } catch {
    toast(t('link-in-url'));
  }
}

function exportFile() {
  const blob = new Blob([JSON.stringify(serialize(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(state.title || t('untitled')).replace(/[^\p{L}\p{N}_-]+/gu, '_') || 'notebook'}.cauchy.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = async () => {
    const f = input.files[0];
    if (!f) return;
    try {
      load(JSON.parse(await f.text()));
    } catch (e) {
      toast(t('bad-file', e.message));
    }
  };
  input.click();
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t.timer);
  t.timer = setTimeout(() => t.classList.remove('show'), 2600);
}

// --------------------------------------------------------------- referência

const TYPE_NAMES = {
  fmpz: 'ZZ', fmpq: 'QQ', arb: 'RR', acb: 'CC', zmod: 'Zmod(n)', fq: 'GF(q)', si: 'int', ui: 'int ≥ 0', d: 'real',
  str: 'string', int: 'int', fmpz_poly: 'ZZ[x]', fmpq_poly: 'QQ[x]', arb_poly: 'RR[x]', acb_poly: 'CC[x]',
  zmod_poly: 'Zmod(n)[x]', fq_poly: 'GF(q)[x]', fmpz_mat: 'Mat(ZZ)', fmpq_mat: 'Mat(QQ)', arb_mat: 'Mat(RR)',
  acb_mat: 'Mat(CC)', zmod_mat: 'Mat(Zmod(n))', fq_mat: 'Mat(GF(q))', modctx: 'R', fqctx: 'F',
};
const FLINT_GROUPS = ['fmpz_poly', 'fmpq_poly', 'arb_poly', 'acb_poly', 'zmod_poly', 'fq_poly', 'fmpz_mat', 'fmpq_mat',
  'arb_mat', 'acb_mat', 'zmod_mat', 'fq_mat', 'fmpz', 'fmpq', 'arb', 'acb', 'zmod', 'fq', 'n'];

function refEntries() {
  const out = [...REF.values()];
  // Builtins sem entrada detalhada (não deveria acontecer) entram em "Diversos".
  for (const [n, d] of state.docs) {
    if (!REF.has(n) && !ALIASES[n]) out.push({ name: n, cat: 'misc', sig: n, pt: d, en: d, examples: [], flint: [] });
  }
  return out;
}

function flintLinks(fns) {
  return fns.map((fn) => {
    const url = flintDocUrl(fn);
    return url ? `<a href="${url}" target="_blank" rel="noopener"><code>${esc(fn)}</code></a>` : `<code>${esc(fn)}</code>`;
  }).join(' ');
}

function drawFunctions(q, cat) {
  const lang = getLang();
  const aliasOf = Object.entries(ALIASES).filter(([a, n]) => a.toLowerCase().includes(q) && q).map(([, n]) => n);
  const items = refEntries().filter((e) => (!cat || e.cat === cat) && (!q || aliasOf.includes(e.name) ||
    [e.name, e.sig, e[lang], ...e.flint].some((x) => x.toLowerCase().includes(q))));
  if (!items.length) return `<p class="muted">—</p>`;
  const exact = items.find((e) => e.name.toLowerCase() === q) ?? (aliasOf.length === 1 ? items.find((e) => e.name === aliasOf[0]) : null);
  return CATEGORIES.map(([id, pt, en]) => {
    const group = items.filter((e) => e.cat === id);
    if (!group.length) return '';
    return `<h3>${esc(lang === 'pt' ? pt : en)}</h3>` + group.map((e) => `
      <details class="fn" ${e === exact || items.length === 1 ? 'open' : ''}>
        <summary><code class="sig">${esc(e.sig)}</code><span class="desc">${esc(e[lang])}</span></summary>
        <div class="fn-body">
          ${e.examples.length ? `<div class="lbl2">${t('ref.examples')}</div>` + e.examples.map((x) => `
            <div class="ex"><code>${esc(x)}</code><button data-ex="${esc(x)}" title="${esc(t('ref.newcell'))}">${t('ref.insert')}</button></div>`).join('') : ''}
          ${e.flint.length ? `<div class="lbl2">${t('ref.uses')}</div><div class="fl">${flintLinks(e.flint)}</div>` : ''}
        </div>
      </details>`).join('');
  }).join('');
}

function drawFlint(q) {
  const names = Object.keys(state.sigs).filter((n) => !q || n.toLowerCase().includes(q) || state.sigs[n][2].toLowerCase().includes(q));
  const groups = new Map();
  for (const n of names) {
    const g = FLINT_GROUPS.find((p) => n.startsWith(p + '_')) ?? 'n';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(n);
  }
  const row = (n) => {
    const [ret, args, cfn] = state.sigs[n];
    const shown = args.filter((a) => a !== 'prec').map((a) => TYPE_NAMES[a] ?? a);
    const call = `flint("${n}"${shown.length ? ', ' + shown.join(', ') : ''})`;
    const r = TYPE_NAMES[ret.split('@')[0]] ?? ret;
    const c = cfn.startsWith('h_') ? `<span class="muted">${esc(cfn)}</span>` : flintLinks([cfn]);
    return `<div class="fx"><button class="fx-call" data-ex="${esc(`flint("${n}", )`)}"><code>${esc(call)}</code></button>
      <span class="fx-meta">→ ${esc(r)} · ${c}</span></div>`;
  };
  return `<p class="muted intro">${esc(t('ref.flint-intro'))}</p><p class="muted">${esc(t('ref.count', names.length))}</p>` +
    [...groups].map(([g, ns]) => `<h3>${esc(g === 'n' ? 'ulong / outros' : g)}</h3>${ns.map(row).join('')}`).join('');
}

function drawSyntax() {
  const lang = getLang();
  return `<pre class="syntax-code">${esc(SYNTAX_CODE[lang])}</pre><div class="syntax-notes">${SYNTAX_NOTES[lang]}</div>`;
}

function buildReference() {
  const body = $('#ref-body');
  const filter = $('#ref-filter');
  const catSel = $('#ref-cat');
  const lang = getLang();
  const cur = catSel.value;
  catSel.innerHTML = `<option value="">${esc(t('ref.all'))}</option>` +
    CATEGORIES.map(([id, pt, en]) => `<option value="${id}">${esc(lang === 'pt' ? pt : en)}</option>`).join('');
  catSel.value = cur;
  const draw = () => {
    const q = filter.value.trim().toLowerCase();
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === state.refTab));
    catSel.hidden = state.refTab !== 'functions';
    filter.hidden = state.refTab === 'syntax';
    body.innerHTML = state.refTab === 'functions' ? drawFunctions(q, catSel.value)
      : state.refTab === 'flint' ? drawFlint(q) : drawSyntax();
  };
  filter.oninput = draw;
  catSel.onchange = draw;
  document.querySelector('.tabs').onclick = (ev) => {
    const b = ev.target.closest('button[data-tab]');
    if (!b) return;
    state.refTab = b.dataset.tab;
    draw();
  };
  body.onclick = (ev) => {
    const b = ev.target.closest('button[data-ex]');
    if (!b) return;
    const src = b.dataset.ex;
    const ta = state.lastTa;
    const after = ta ? state.cells.find((c) => c.el.contains(ta)) : state.cells[state.cells.length - 1];
    // Célula vazia corrente é reaproveitada.
    let c = after && !after.src.trim() ? after : createCell(src, after ?? null);
    if (c === after) {
      const t2 = $('textarea', c.el);
      t2.value = src;
      c.src = src;
      refreshHighlight(c);
      autosize(c);
    }
    const t3 = $('textarea', c.el);
    t3.focus();
    if (src.endsWith(', )')) t3.setSelectionRange(src.length - 1, src.length - 1);
    else evalCell(c);
    save();
    c.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  draw();
}

function applyLang(lang) {
  setLang(lang);
  $('#lang').value = lang;
  applyStatic();
  state.cells.forEach((c) => applyStatic(c.el));
  if (!state.title) $('#title').placeholder = t('untitled');
  $('#examples').innerHTML = `<option value="">${esc(t('examples'))}</option>` +
    EXAMPLES.map((e, i) => `<option value="${i}">${esc(pick(e.title, lang))}</option>`).join('');
  if (state.status) setStatus(...state.status);
  if (state.live !== undefined) $('#live').textContent = t('objects', state.live);
  buildReference();
  for (const c of state.cells) if (c.result) { c.relang = true; showResult(c, c.result); c.relang = false; }
}

// Troca ->, <-, =>, |>, <=, >= e != por →, ←, ⇒, ▷, ≤, ≥ e ≠ quando o segundo
// caractere é digitado. Usa execCommand para que Ctrl+Z desfaça a troca; o
// evento de entrada aninhado cuida do resto (devolve true nesse caso).
function symbolize(ta, ev) {
  if (!$('#unicode').checked || ev.inputType !== 'insertText' || !['>', '-', '='].includes(ev.data)) return false;
  const end = ta.selectionStart;
  if (end !== ta.selectionEnd) return false;
  const sym = symbolAt(ta.value, end);
  if (!sym) return false;
  ta.setSelectionRange(end - 2, end);
  if (document.execCommand && document.execCommand('insertText', false, sym)) return true;
  ta.setRangeText(sym, end - 2, end, 'end');
  return false;
}

// --------------------------------------------------------------- tema

// Tema efetivo: escolha salva (data-theme) ou, sem ela, o do sistema.
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const currentTheme = () => document.documentElement.dataset.theme ?? (darkQuery.matches ? 'dark' : 'light');

function showThemeIcon() {
  // O ícone indica o tema para o qual o botão leva.
  $('#theme').textContent = currentTheme() === 'dark' ? '☀' : '☾';
}

function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem('cauchy.theme', next);
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
  showThemeIcon();
}

// --------------------------------------------------------------- inicialização

async function initialNotebook() {
  const m = /#nb=([\w-]+)/.exec(location.hash);
  if (m) {
    try {
      return JSON.parse(await decompress(m[1]));
    } catch {
      toast(t('bad-link'));
    }
  }
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // ignora
  }
  return EXAMPLES[0];
}

async function main() {
  applyLang(detectLang());
  $('#lang').onchange = (ev) => applyLang(ev.target.value);
  $('#theme').onclick = toggleTheme;
  darkQuery.addEventListener('change', showThemeIcon);
  showThemeIcon();
  const examples = $('#examples');
  examples.onchange = () => {
    const e = EXAMPLES[+examples.value];
    examples.value = '';
    if (e) load(e);
  };
  $('#title').oninput = (ev) => { state.title = ev.target.value; save(); };
  $('#add').onclick = () => createCell('', state.cells[state.cells.length - 1], true);
  $('#run-all').onclick = () => evalAll();
  $('#stop').onclick = () => interrupt();
  $('#share').onclick = () => share();
  $('#export').onclick = () => exportFile();
  $('#import').onclick = () => importFile();
  $('#new').onclick = () => load({ title: '', cells: [''] });
  $('#help').onclick = () => document.body.classList.toggle('show-ref');
  $('#autorun').checked = localStorage.getItem('cauchy.autorun') !== '0';
  $('#autorun').onchange = (ev) => localStorage.setItem('cauchy.autorun', ev.target.checked ? '1' : '0');
  $('#unicode').checked = localStorage.getItem('cauchy.unicode') !== '0';
  $('#unicode').onchange = (ev) => localStorage.setItem('cauchy.unicode', ev.target.checked ? '1' : '0');
  document.addEventListener('focusin', (ev) => { if (ev.target.tagName === 'TEXTAREA') state.lastTa = ev.target; });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === '.' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); interrupt(); }
  });
  window.addEventListener('resize', () => state.cells.forEach(autosize));

  startWorker();
  const nb = await initialNotebook();
  load(nb);
}

main();

export { ringName };
