// Análise estática de células: nomes definidos e variáveis livres.

import { patternNames } from './eval.js';

// Nomes definidos no nível superior de uma lista de declarações.
export function definedNames(stmts) {
  const out = new Set();
  for (const s of stmts) {
    if (s.k === 'fun') out.add(s.name);
    else if (s.k === 'def') patternNames(s.pat).forEach((n) => out.add(n));
  }
  return out;
}

// Variáveis livres de uma célula (excluindo as que ela mesma define).
// `weak` contém nomes usados como índice isolado (R[x]), que podem ser apenas
// o nome da variável de um anel de polinômios: viram dependência só se não
// criarem ciclo.
export function freeVars(stmts) {
  const free = new Set();
  const weak = new Set();
  const own = definedNames(stmts);
  const bound = [own];
  const isBound = (n) => bound.some((s) => s.has(n));
  const scoped = (names, fn) => {
    bound.push(new Set(names));
    try { fn(); } finally { bound.pop(); }
  };
  const pat = (p) => {
    if (p.k === 'plit') walk(p.lit);
    if (p.items) p.items.forEach(pat);
    if (p.rest) pat(p.rest);
  };
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    switch (n.k) {
      case 'var':
        if (!isBound(n.name)) free.add(n.name);
        return;
      case 'lambda':
        n.params.forEach(pat);
        scoped(n.params.flatMap((p) => patternNames(p)), () => walk(n.body));
        return;
      case 'fun':
        n.params.forEach(pat);
        scoped([n.name, ...n.params.flatMap((p) => patternNames(p))], () => walk(n.body));
        return;
      case 'def':
        pat(n.pat);
        walk(n.expr);
        return;
      case 'let': {
        const names = n.binds.flatMap((b) => (b.k === 'fun' ? [b.name] : patternNames(b.pat)));
        scoped(names, () => { n.binds.forEach(walk); walk(n.body); });
        return;
      }
      case 'comp': {
        const names = [];
        bound.push(new Set());
        try {
          for (const c of n.clauses) {
            if (c.k === 'gen') {
              walk(c.src);
              pat(c.pat);
              patternNames(c.pat).forEach((x) => bound[bound.length - 1].add(x));
              names.push(...patternNames(c.pat));
            } else walk(c.cond);
          }
          walk(n.expr);
        } finally {
          bound.pop();
        }
        return;
      }
      case 'match':
        walk(n.e);
        for (const a of n.arms) {
          pat(a.pat);
          scoped(patternNames(a.pat), () => { walk(a.guard); walk(a.body); });
        }
        return;
      case 'field':
        walk(n.obj);
        if (!isBound(n.name)) free.add(n.name);
        return;
      case 'index':
        walk(n.obj);
        (n.kwargs ?? []).forEach((kw) => walk(kw.expr));
        // R[x] e R[x, y]: nomes isolados como índices podem ser só nomes de variáveis.
        if (n.idx.length && n.idx.every((i) => i.k === 'var')) {
          for (const i of n.idx) if (!isBound(i.name)) weak.add(i.name);
          return;
        }
        n.idx.forEach(walk);
        return;
    }
    for (const key of Object.keys(n)) {
      if (key === 'pos' || key === 'end') continue;
      const v = n[key];
      if (key === 'kwargs' || key === 'opts') v.forEach((kw) => walk(kw.expr));
      else if (key === 'arms' || key === 'clauses') continue;
      else if (Array.isArray(v)) v.forEach((x) => (Array.isArray(x) ? x.forEach(walk) : walk(x)));
      else if (v && typeof v === 'object' && v.k) walk(v);
    }
  };
  stmts.forEach(walk);
  for (const w of free) weak.delete(w);
  return { free, weak };
}
