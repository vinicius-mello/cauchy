// Aplicação principal (thread da UI): células, editor, comunicação com o
// worker, persistência e painel de referência.

import { render, ringName, esc } from './render.js';
import { renderGraphics, handleKey } from './plot.js';
import { highlight, symbolAt, KEYWORDS } from './highlight.js';
import { typeChar, backspace, newline, wordBefore, identifiers, complete, callAt } from './editing.js';
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
  cells: [], // {id, src, widgets: {chave: {kind, value}}, el, result, dirty}
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
      state.docMap = null;
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
  const c = { id: newId(), src, widgets: {}, result: null, el: null, timer: null, sentSrc: null };
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
      <button class="hidden-note" data-act="hide" data-i18n="cell.hidden"></button>
    </div>
    <div class="tools">
      <button data-act="run" data-i18n-title="cell.run">▶</button>
      <button data-act="hide" data-i18n-title="cell.hide">‹›</button>
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
    assistOnInput(ta, ev);
    refreshHighlight(c);
    autosize(c);
    markStale(c);
    save();
    if ($('#autorun').checked) {
      clearTimeout(c.timer);
      c.timer = setTimeout(() => evalCell(c), AUTORUN_MS);
    }
  });
  ta.addEventListener('keydown', (ev) => { if (!assistKey(ev, ta) && !editKey(ev, ta)) onKey(ev, c); });
  ta.addEventListener('click', () => showSignature(ta));
  ta.addEventListener('keyup', (ev) => { if (ev.key.startsWith('Arrow') && !state.assist?.items) showSignature(ta); });
  ta.addEventListener('blur', closeAssist);
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
    case 'run': evalCell(c, true); break;
    case 'hide': setHidden(c, !c.hidden); save(); break;
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

// Esconde (ou mostra) o código da célula, deixando só a saída.
function setHidden(c, hidden) {
  c.hidden = hidden;
  c.el.classList.toggle('hide-src', hidden);
  const b = $('.tools button[data-act="hide"]', c.el);
  b.dataset.i18nTitle = hidden ? 'cell.show' : 'cell.hide';
  b.title = t(b.dataset.i18nTitle);
  const ta = $('textarea', c.el);
  if (hidden) ta.blur();
  else {
    autosize(c);
    ta.focus();
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
    evalCell(c, true);
    const i = state.cells.indexOf(c);
    const next = state.cells[i + 1] ?? createCell('', c);
    $('textarea', next.el).focus();
  } else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
    ev.preventDefault();
    evalCell(c, true);
  } else if (ev.key === 'Enter' && ev.altKey) {
    ev.preventDefault();
    evalCell(c, true);
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

// Avaliação explícita (reset): os pontos de controle da célula voltam aos
// valores iniciais do código e as janelas fixadas pelo arraste se soltam.
function evalCell(c, reset = false) {
  clearTimeout(c.timer);
  if (reset) {
    for (const [k, w] of Object.entries(c.widgets)) {
      if (w && (w.kind === 'handle' || w.kind === 'handles')) c.widgets[k] = { kind: w.kind, value: null };
    }
    for (const d of state.cells) d.view = null;
    save();
  }
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

// Chave da estrutura dos controles (painel e widget exibido): se não muda, os
// controles ficam no DOM (recriá-los durante o arraste interromperia o gesto).
function controlsKey(res) {
  if (res.status !== 'ok') return null;
  const ws = (res.panel ?? []).map((p) => [p.label, p.d.kind, p.d.spec]);
  const d = res.display;
  if (!ws.length && d?.t !== 'widget') return null;
  return JSON.stringify([ws, d?.t === 'widget' ? [d.kind, d.spec] : null]);
}

function showResult(c, res) {
  const out = $('.out', c.el);
  if (res.status === 'ok' && res.widgets) {
    // Estado dos widgets que a avaliação criou; o valor local mais recente
    // prevalece (pode haver envios ainda não avaliados).
    c.widgets = Object.fromEntries(Object.entries(res.widgets).map(([k, w]) => [k, c.widgets[k] ?? w]));
    save();
  }
  const key = controlsKey(res);
  if (key && key === c.widgetKey && c.result?.status === 'ok' && !c.relang) {
    c.result = res;
    c.el.classList.remove('running', 'slow', 'stale');
    const wraps = out.querySelectorAll(':scope > .panel > .widget');
    (res.panel ?? []).forEach((p, k) => wraps[k] && refreshWidget(wraps[k], p.d));
    if (res.display?.t === 'widget') {
      const w = out.querySelector(':scope > .val .widget');
      if (w) refreshWidget(w, res.display);
    } else {
      out.querySelectorAll(':scope > .val, :scope > .ms').forEach((e) => e.remove());
      appendVal(c, out, res);
    }
    return;
  }
  c.widgetKey = key;
  c.result = res;
  const el = c.el;
  el.classList.remove('running', 'slow', 'stale', 'ok', 'error', 'upstream');
  const dot = $('.dot', el);
  if (res.status === 'error') {
    el.classList.add('error');
    if (res.upstream) el.classList.add('upstream');
    out.innerHTML = `<div class="err">${esc(translateError(res.error.message))}</div>`;
    dot.title = t('error');
  } else {
    el.classList.add('ok');
    dot.title = res.ms !== undefined ? `${res.ms < 1 ? '<1' : Math.round(res.ms)} ms` : '';
    out.innerHTML = '';
    if (res.panel?.length) {
      const panel = document.createElement('div');
      panel.className = 'panel';
      panel.style.setProperty('--wl', `${Math.max(...res.panel.map((p) => (p.d.spec.label ?? p.label ?? '').length))}ch`);
      for (const p of res.panel) {
        const slot = document.createElement('div');
        panel.append(slot);
        mountSlot(c, slot, p.d, p.label);
      }
      out.append(panel);
    }
    appendVal(c, out, res);
  }
  refreshHighlight(c);
}

// Valor exibido da célula (a última expressão) e o tempo, se longo.
function appendVal(c, out, res) {
  if (res.display) {
    const { html, slots } = render(res.display);
    const label = res.label && res.display.t !== 'fn' && res.display.t !== 'widget' ? `<span class="lbl">${esc(res.label)} =</span>` : '';
    const val = document.createElement('div');
    val.className = 'val';
    val.innerHTML = `${label}<div class="math">${html}</div>`;
    out.append(val);
    val.querySelectorAll('.slot').forEach((slot) => mountSlot(c, slot, slots[+slot.dataset.slot], res.label));
  }
  if (res.ms > 50) out.insertAdjacentHTML('beforeend', `<div class="ms">${Math.round(res.ms)} ms</div>`);
}

// Atualiza a leitura de um controle mantido no DOM.
function refreshWidget(wrap, d) {
  const outv = $('output', wrap);
  const v = d.value;
  const sliding = document.activeElement?.type === 'range' && wrap.contains(document.activeElement);
  if (outv && !sliding) outv.textContent = v && typeof v === 'object' ? v.text : v;
  // Ponto de controle: campos x e y acompanham o valor (se não estão em edição).
  if (v && typeof v === 'object' && !Array.isArray(v.at[0])) {
    wrap.querySelectorAll('input.coord').forEach((inp, k) => {
      if (document.activeElement !== inp) inp.value = fmtCoord(v.at[k]);
    });
  }
}

function mountSlot(c, slot, d, name) {
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
    const label = d.spec.label ?? name ?? '';
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
  return { title: state.title, cells: state.cells.map((c) => ({ src: c.src, widgets: c.widgets, ...(c.hidden ? { hidden: true } : {}) })) };
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
    if (cell.hidden) setHidden(c, true);
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

// --------------------------------------------------------------- assistência

// Aplica uma edição de editing.js. Usa execCommand para que Ctrl+Z desfaça;
// o evento de entrada resultante atualiza a célula.
function applyEdit(ta, r) {
  ta.setSelectionRange(r.start, r.end);
  if (r.start !== r.end || r.text) {
    const ok = document.execCommand && document.execCommand(r.text ? 'insertText' : 'delete', false, r.text);
    if (!ok) {
      ta.setRangeText(r.text, r.start, r.end, 'end');
      ta.dispatchEvent(new Event('input'));
    }
  }
  ta.setSelectionRange(...r.sel);
}

// Pares de delimitadores, Backspace num par vazio e Enter com indentação.
function editKey(ev, ta) {
  if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.isComposing) return false;
  const s = ta.selectionStart, e = ta.selectionEnd;
  let r = null;
  if (ev.key.length === 1 && '()[]{}"'.includes(ev.key)) r = typeChar(ta.value, s, e, ev.key);
  else if (ev.key === 'Backspace') r = backspace(ta.value, s, e);
  else if (ev.key === 'Enter' && !ev.shiftKey) r = newline(ta.value, s, e);
  if (!r) return false;
  ev.preventDefault();
  applyEdit(ta, r);
  return true;
}

const docMap = () => (state.docMap ??= new Map(state.docs));

// Assinatura de um nome: a da referência ou a do docstring da função.
function signatureOf(name) {
  const ref = REF.get(ALIASES[name] ?? name);
  if (ref) return ref.sig;
  const doc = docMap().get(name);
  if (!doc) return null;
  const k = doc.indexOf('): ');
  return k >= 0 ? doc.slice(0, k + 1) : null;
}

// Elemento flutuante (lista de sugestões ou assinatura), junto ao cursor.
function assistEl() {
  let el = $('#assist');
  if (!el) {
    el = document.createElement('div');
    el.id = 'assist';
    el.setAttribute('role', 'listbox');
    el.hidden = true;
    // Clicar numa sugestão não tira o foco do editor.
    el.addEventListener('mousedown', (ev) => {
      ev.preventDefault();
      const li = ev.target.closest('[data-k]');
      if (li && state.assist?.items) { state.assist.idx = +li.dataset.k; acceptCompletion(); }
    });
    document.body.append(el);
  }
  return el;
}

// Posição do cursor na tela: espelho do editor com um marcador no ponto.
function caretRect(ta, pos) {
  const pre = document.createElement('pre');
  pre.className = 'mirror';
  pre.textContent = ta.value.slice(0, pos);
  const mark = document.createElement('span');
  mark.textContent = '​';
  pre.append(mark);
  ta.parentElement.append(pre);
  const r = mark.getBoundingClientRect();
  pre.remove();
  return r;
}

function placeAssist(ta, pos) {
  const el = assistEl();
  el.hidden = false;
  const r = caretRect(ta, pos);
  const h = el.offsetHeight, w = el.offsetWidth;
  const below = r.bottom + 2 + h <= window.innerHeight || r.top - h - 2 < 0;
  el.style.top = `${below ? r.bottom + 2 : r.top - h - 2}px`;
  el.style.left = `${Math.max(4, Math.min(r.left, window.innerWidth - w - 4))}px`;
}

function closeAssist() {
  state.assist = null;
  const el = $('#assist');
  if (el) el.hidden = true;
}

// Candidatos: palavras-chave, funções embutidas e nomes do caderno.
function candidates() {
  const kind = new Map();
  for (const c of state.cells) for (const n of identifiers(c.src)) kind.set(n, 'var');
  for (const n of state.builtins) kind.set(n, 'bi');
  for (const n of KEYWORDS) kind.set(n, 'kw');
  return kind;
}

function showCompletions(ta, explicit = false) {
  const pos = ta.selectionStart;
  if (pos !== ta.selectionEnd) return closeAssist();
  const w = wordBefore(ta.value, pos) ?? (explicit ? { word: '', start: pos } : null);
  if (!w || (!explicit && w.word.length < 2)) return closeAssist();
  // Não sugere no meio de uma palavra.
  if (/(?![⁰¹²³⁴⁵⁶⁷⁸⁹])[\p{L}\p{N}_']/u.test(ta.value[pos] ?? '')) return closeAssist();
  const kind = candidates();
  const items = complete(w.word, kind.keys(), explicit ? 30 : 12);
  if (!items.length) return explicit ? showSignature(ta) : closeAssist();
  // Enter só aceita depois de escolher com as setas (ou com Ctrl+Espaço),
  // para não atrapalhar quem só quer mudar de linha; Tab sempre aceita.
  state.assist = { ta, start: w.start, items, idx: 0, kind, chosen: explicit };
  drawCompletions();
  placeAssist(ta, w.start);
}

function drawCompletions() {
  const a = state.assist;
  const el = assistEl();
  el.className = 'completions';
  const lang = getLang();
  el.innerHTML = a.items.map((n, k) => {
    const sig = a.kind.get(n) === 'bi' ? signatureOf(n) : null;
    const ref = k === a.idx ? REF.get(ALIASES[n] ?? n) : null;
    const desc = ref ? `<div class="ac-desc">${esc(ref[lang] ?? ref.pt)}</div>` : '';
    return `<div class="ac-item${k === a.idx ? ' sel' : ''}" data-k="${k}" role="option" aria-selected="${k === a.idx}">` +
      `<span class="ac-name t-${a.kind.get(n)}">${esc(n)}</span>` +
      (sig && sig !== n ? `<span class="ac-sig">${esc(sig)}</span>` : '') + desc + '</div>';
  }).join('');
  el.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
}

// Funções recebem parênteses (com o cursor dentro); constantes e anéis não.
function isFunction(name) {
  const sig = signatureOf(name);
  return !!sig && sig.startsWith(name + '(');
}

function acceptCompletion() {
  const a = state.assist;
  const { ta } = a;
  const name = a.items[a.idx];
  const pos = ta.selectionStart;
  if (wordBefore(ta.value, pos)?.start !== a.start) return closeAssist();
  const call = a.kind.get(name) === 'bi' && isFunction(name) && ta.value[pos] !== '(';
  const text = call ? name + '()' : name;
  const at = a.start + name.length + (call ? 1 : 0);
  closeAssist();
  applyEdit(ta, { text, start: a.start, end: pos, sel: [at, at] });
  closeAssist();
  if (call) showSignature(ta);
}

// Navegação na lista de sugestões; Ctrl+Espaço abre a lista.
function assistKey(ev, ta) {
  if (ev.key === ' ' && (ev.ctrlKey || ev.metaKey)) {
    ev.preventDefault();
    showCompletions(ta, true);
    return true;
  }
  const a = state.assist;
  if (!a) return false;
  if (ev.key === 'Escape') {
    ev.preventDefault();
    closeAssist();
    return true;
  }
  if (!a.items) return false;
  const mods = ev.ctrlKey || ev.metaKey || ev.altKey || ev.shiftKey;
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    ev.preventDefault();
    const n = a.items.length;
    a.idx = (a.idx + (ev.key === 'ArrowDown' ? 1 : n - 1)) % n;
    a.chosen = true;
    drawCompletions();
    return true;
  }
  if (((ev.key === 'Enter' && a.chosen) || ev.key === 'Tab') && !mods) {
    ev.preventDefault();
    acceptCompletion();
    return true;
  }
  if (ev.key === 'Enter' || ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') closeAssist();
  return false;
}

// Assinatura da função cuja chamada contém o cursor, com o argumento
// corrente em destaque.
function showSignature(ta) {
  const pos = ta.selectionStart;
  const call = pos === ta.selectionEnd ? callAt(ta.value, pos) : null;
  const sig = call && signatureOf(call.name);
  if (!sig) return closeAssist();
  const el = assistEl();
  el.className = 'signature';
  el.innerHTML = signatureHtml(sig, call.name, call.arg);
  state.assist = { ta, sig: true };
  placeAssist(ta, pos);
}

// Divide nas vírgulas de nível 0 (fora de parênteses e colchetes).
function splitTop(s) {
  const out = [];
  let depth = 0, a = 0;
  for (let k = 0; k < s.length; k++) {
    if ('([{'.includes(s[k])) depth++;
    else if (')]}'.includes(s[k])) depth--;
    else if (s[k] === ',' && depth === 0) { out.push(s.slice(a, k)); a = k + 1; }
  }
  out.push(s.slice(a));
  return out.map((x) => x.trim());
}

// A assinatura pode ter várias formas ("gen(R), gen(R, k)"): mostra a
// primeira com argumentos suficientes.
function signatureHtml(sig, name, arg) {
  const forms = splitTop(sig).filter((f) => f.includes('('));
  const parsed = forms.map((f) => {
    const a = f.indexOf('('), b = f.lastIndexOf(')');
    return { head: f.slice(0, a), args: b > a + 1 ? splitTop(f.slice(a + 1, b)) : [], tail: f.slice(b + 1) };
  });
  const form = parsed.find((p) => p.args.length > arg) ?? parsed[parsed.length - 1];
  if (!form) return esc(sig);
  const args = form.args.map((x, k) => (k === arg ? `<b>${esc(x)}</b>` : esc(x))).join(', ');
  return `<span class="t-bi">${esc(form.head)}</span>(${args})${esc(form.tail)}`;
}

function assistOnInput(ta, ev) {
  const typed = ev.inputType === 'insertText' && ev.data && /(?![⁰¹²³⁴⁵⁶⁷⁸⁹])[\p{L}\p{N}_']$/u.test(ev.data);
  if (typed || (ev.inputType?.startsWith('delete') && state.assist?.items)) showCompletions(ta);
  else if (state.assist?.items) closeAssist();
  if (!state.assist?.items) showSignature(ta);
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
  window.addEventListener('scroll', closeAssist, true);

  startWorker();
  const nb = await initialNotebook();
  load(nb);
}

main();

export { ringName };
