// Valores da linguagem que não são elementos de anéis.
// Listas são arrays JS; strings e booleanos são nativos.

export class Tuple {
  constructor(items) {
    this.items = items;
  }
}

export const UNIT = new Tuple([]);

// Função: closure da linguagem ou builtin JS.
export class Func {
  constructor(name, arity, impl, opts = {}) {
    this.name = name;
    this.arity = arity; // número de parâmetros, ou null se variádica
    this.impl = impl; // (args, kwargs, ctx) => valor
    this.lazy = opts.lazy ?? false;
  }
}

// Fatoração: lista de tuplas (base, expoente) com unidade.
export class Factored extends Array {
  static get [Symbol.species]() {
    return Array;
  }
}

// Gráfico: lista de primitivas já convertidas em números de ponto flutuante
// ({g: 'line'|'points'|'circle'|..., attrs}) e opções da janela (xlim, ylim,
// aspect, axes, ...). Não guarda handles FLINT.
export class Graphic {
  constructor(items, opts = {}) {
    this.items = items;
    this.opts = opts;
  }
  // g1 + g2: junta as primitivas; opções da esquerda têm prioridade.
  concat(other) {
    return new Graphic([...this.items, ...other.items], { ...other.opts, ...this.opts });
  }
  display() {
    return { t: 'graphics', items: this.items, opts: this.opts };
  }
}

// Lista (possivelmente aninhada) só de gráficos vira um gráfico; senão null.
export function asGraphic(v) {
  if (v instanceof Graphic) return v;
  if (!Array.isArray(v) || !v.length) return null;
  let acc = new Graphic([]);
  for (const x of v) {
    const g = asGraphic(x);
    if (!g) return null;
    acc = acc.concat(g);
  }
  return acc;
}

// Widget de entrada: o valor corrente vem da UI.
export class Widget {
  constructor(kind, spec, value, valueDisplay) {
    this.kind = kind;
    this.spec = spec;
    this.value = value;
    this.valueDisplay = valueDisplay;
  }
  display() {
    return { t: 'widget', kind: this.kind, spec: this.spec, value: this.valueDisplay };
  }
}
