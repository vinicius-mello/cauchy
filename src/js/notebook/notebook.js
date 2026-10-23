// Notebook reativo: células com definições, grafo de dependências pelas
// variáveis livres, reavaliação mínima em ordem topológica e gerência de
// memória por célula (arenas).

import { parse } from '../lang/parser.js';
import { CauchyError } from '../lang/lexer.js';
import { Env, EvalContext, withContext, bindDefs } from '../lang/eval.js';
import { definedNames, freeVars } from '../lang/analyze.js';
import { makeGlobals } from '../lang/builtins.js';
import { Elem, flint } from '../runtime/rings.js';
import { Tuple, Func, Factored, Widget } from '../runtime/values.js';
import { display } from '../runtime/show.js';

class Cell {
  constructor(id, src) {
    this.id = id;
    this.src = src;
    this.stmts = [];
    this.parseError = null;
    this.defs = new Set();
    this.free = new Set();
    this.weak = new Set();
    this.deps = new Set(); // ids de células
    this.owned = []; // elementos FLINT vivos pertencentes à célula
    this.widgets = [];
    this.result = null;
    this.ok = false;
    this.reparse();
  }

  reparse() {
    this.parseError = null;
    try {
      this.stmts = parse(this.src);
      this.defs = definedNames(this.stmts);
      const { free, weak } = freeVars(this.stmts);
      this.free = free;
      this.weak = weak;
    } catch (e) {
      if (!(e instanceof CauchyError)) throw e;
      this.stmts = [];
      this.defs = new Set();
      this.free = new Set();
      this.weak = new Set();
      this.parseError = { message: e.message, pos: e.pos, end: e.end };
    }
  }
}

export class Notebook {
  constructor({ onStart = null, onResult = null } = {}) {
    this.globals = makeGlobals();
    this.scope = new Env(this.globals);
    this.cells = new Map();
    this.graphErrors = new Map();
    this.onStart = onStart;
    this.onResult = onResult;
  }

  // Atualiza (ou cria) células e reavalia o necessário. Devolve resultados
  // das células avaliadas, na ordem de avaliação.
  update(changes, { skip = [] } = {}) {
    const before = this.dependents([...changes.map((c) => c.id)]);
    for (const { id, src, widgets } of changes) {
      let cell = this.cells.get(id);
      if (src === null) {
        if (cell) this.dropCell(cell);
        continue;
      }
      if (!cell) {
        cell = new Cell(id, src);
        this.cells.set(id, cell);
      } else if (cell.src !== src) {
        cell.src = src;
        cell.reparse();
      }
      if (widgets) cell.widgets = widgets;
    }
    const snap = this.graphSnapshot();
    this.buildGraph();
    const now = this.graphSnapshot();
    // Células cuja estrutura no grafo mudou (dependências ou erros de grafo).
    const restructured = [...now.keys()].filter((id) => snap.get(id) !== now.get(id));
    const after = this.dependents([...changes.filter((c) => c.src !== null).map((c) => c.id), ...restructured]);
    const dirty = new Set([...before, ...after].filter((id) => this.cells.has(id)));
    return this.run(dirty, new Set(skip));
  }

  graphSnapshot() {
    const m = new Map();
    for (const c of this.cells.values()) {
      m.set(c.id, [...c.deps].sort().join(',') + '|' + (this.graphErrors.get(c.id) ?? ''));
    }
    return m;
  }

  setWidget(id, index, value) {
    const cell = this.cells.get(id);
    if (!cell) return [];
    cell.widgets[index] = { ...(cell.widgets[index] ?? {}), value };
    return this.run(this.dependents([id]), new Set());
  }

  dropCell(cell) {
    this.release(cell);
    this.cells.delete(cell.id);
  }

  release(cell) {
    const F = flint();
    for (const name of cell.defs) {
      if (this.owner(name) === cell.id) this.scope.vars.delete(name);
    }
    for (const e of cell.owned) F.release(e);
    cell.owned = [];
    cell.ok = false;
  }

  owner(name) {
    return this.scopeOwner?.get(name);
  }

  buildGraph() {
    const definers = new Map();
    for (const c of this.cells.values()) {
      for (const n of c.defs) {
        if (!definers.has(n)) definers.set(n, []);
        definers.get(n).push(c.id);
      }
    }
    this.graphErrors = new Map();
    this.definers = definers;
    for (const [n, ids] of definers) {
      if (ids.length > 1) {
        for (const id of ids) this.graphErrors.set(id, `'${n}' é definido em mais de uma célula`);
      }
    }
    for (const c of this.cells.values()) {
      c.deps = new Set();
      for (const n of c.free) {
        const ids = definers.get(n);
        if (ids) for (const id of ids) if (id !== c.id) c.deps.add(id);
      }
    }
    // Dependências fracas (R[x]) só se não criarem ciclo.
    for (const c of this.cells.values()) {
      for (const n of c.weak) {
        const ids = definers.get(n) ?? [];
        for (const id of ids) {
          if (id !== c.id && !this.reaches(id, c.id)) c.deps.add(id);
        }
      }
    }
    // Ciclos.
    const state = new Map();
    const stack = [];
    const visit = (id) => {
      state.set(id, 1);
      stack.push(id);
      for (const d of this.cells.get(id).deps) {
        if (state.get(d) === 1) {
          const cyc = stack.slice(stack.indexOf(d));
          const names = cyc.map((x) => [...this.cells.get(x).defs].join(', ')).join(' → ');
          for (const x of cyc) this.graphErrors.set(x, `dependência circular: ${names}`);
        } else if (!state.has(d)) visit(d);
      }
      stack.pop();
      state.set(id, 2);
    };
    for (const id of this.cells.keys()) if (!state.has(id)) visit(id);
  }

  reaches(from, to) {
    const seen = new Set();
    const go = (id) => {
      if (id === to) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      const c = this.cells.get(id);
      return c ? [...c.deps].some(go) : false;
    };
    return go(from);
  }

  // Células que dependem (transitivamente) das dadas, incluindo-as.
  dependents(ids) {
    const out = new Set(ids);
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of this.cells.values()) {
        if (out.has(c.id)) continue;
        if ([...c.deps].some((d) => out.has(d))) {
          out.add(c.id);
          grew = true;
        }
      }
    }
    return out;
  }

  topo(ids) {
    const order = [];
    const seen = new Set();
    const visit = (id) => {
      if (seen.has(id) || !ids.has(id)) return;
      seen.add(id);
      for (const d of this.cells.get(id).deps) visit(d);
      order.push(id);
    };
    // Mantém a ordem de inserção como desempate.
    for (const id of this.cells.keys()) visit(id);
    return order;
  }

  run(dirty, skip) {
    const order = this.topo(dirty);
    for (const id of order) this.release(this.cells.get(id));
    const results = [];
    const skipped = this.dependents([...skip]);
    for (const id of order) {
      const cell = this.cells.get(id);
      if (skipped.has(id)) {
        cell.result = { id, status: 'error', error: { message: skip.has(id) ? 'avaliação interrompida' : 'depende de célula interrompida' } };
      } else {
        this.onStart?.(id);
        cell.result = this.evalCell(cell);
      }
      results.push(cell.result);
      this.onResult?.(cell.result);
    }
    return results;
  }

  evalCell(cell) {
    const F = flint();
    const id = cell.id;
    const defs = [...cell.defs];
    if (cell.parseError) return { id, status: 'error', error: cell.parseError, defs };
    if (this.graphErrors.has(id)) return { id, status: 'error', error: { message: this.graphErrors.get(id) }, defs };
    for (const d of cell.deps) {
      const dc = this.cells.get(d);
      if (!dc.ok) {
        const names = [...dc.defs].filter((n) => cell.free.has(n) || cell.weak.has(n));
        return { id, status: 'error', error: { message: `depende de célula com erro (${names.join(', ')})` }, defs, upstream: true };
      }
    }
    if (cell.stmts.length === 0) {
      cell.ok = true;
      return { id, status: 'ok', display: null, defs };
    }
    const env = new Env(this.scope);
    const ctx = new EvalContext({ widgets: cell.widgets, cellId: id });
    const t0 = performance.now();
    let arena;
    try {
      let shown;
      ({ value: shown, arena } = F.inArena(() => withContext(ctx, () => {
        const v = bindDefs(cell.stmts, env);
        return { v, d: display(v) };
      })));
      const ms = performance.now() - t0;
      cell.widgets = ctx.widgets;
      // Exporta definições e mantém vivos apenas os elementos alcançáveis.
      const keep = new Set();
      const seenEnvs = new Set();
      const mark = (v) => markValue(v, keep, seenEnvs, this.scope);
      mark(shown.v);
      for (const n of cell.defs) {
        const v = env.vars.get(n);
        mark(v);
        this.scope.vars.set(n, v);
        (this.scopeOwner ??= new Map()).set(n, id);
      }
      cell.owned = arena.filter((e) => keep.has(e));
      for (const e of arena) if (!keep.has(e)) F.release(e);
      cell.ok = true;
      const last = cell.stmts[cell.stmts.length - 1];
      const label = last.k === 'def' && last.pat.k === 'pvar' ? last.pat.name : last.k === 'fun' ? last.name : null;
      return { id, status: 'ok', display: shown.d, defs, label, ms };
    } catch (e) {
      arena = e.arena ?? arena;
      if (arena) for (const x of arena) F.release(x);
      cell.ok = false;
      if (F.poisoned) return { id, status: 'error', error: { message: e.message }, defs, fatal: true };
      if (e instanceof CauchyError || e.name === 'FlintError') {
        return { id, status: 'error', error: { message: e.message, pos: e.pos, end: e.end }, defs };
      }
      if (e instanceof RangeError) return { id, status: 'error', error: { message: 'recursão profunda demais' }, defs };
      return { id, status: 'error', error: { message: `erro interno: ${e.message}` }, defs, internal: String(e.stack) };
    }
  }

  liveCount() {
    return flint().live;
  }
}

function markValue(v, keep, seenEnvs, stopEnv) {
  const stack = [v];
  while (stack.length) {
    const x = stack.pop();
    if (x instanceof Elem) keep.add(x);
    else if (Array.isArray(x)) {
      stack.push(...x);
      if (x instanceof Factored && x.unit) stack.push(x.unit);
    } else if (x instanceof Tuple) stack.push(...x.items);
    else if (x instanceof Widget) stack.push(x.value);
    else if (x instanceof Func) {
      if (x.parts) stack.push(...x.parts);
      for (let e = x.env; e && e !== stopEnv && !seenEnvs.has(e); e = e.parent) {
        seenEnvs.add(e);
        stack.push(...e.vars.values());
      }
    } else if (x && typeof x === 'object' && 'v' in x && 'd' in x) stack.push(x.v);
  }
}
