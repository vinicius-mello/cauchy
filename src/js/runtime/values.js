// Valores da linguagem que não são elementos de anéis.
// Listas são arrays JS; strings e booleanos são nativos.

import { fail } from './errors.js';

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
// aspect, axes, ...). Não guarda handles FLINT. Primitivas 3D levam d3: true
// (grupos também, se os filhos são 3D); um gráfico não mistura 2D e 3D.
export class Graphic {
  constructor(items, opts = {}) {
    this.items = items;
    this.opts = opts;
  }
  get is3d() {
    return this.items.length > 0 && this.items[0].d3 === true;
  }
  // g1 + g2: junta as primitivas; opções da esquerda têm prioridade.
  concat(other) {
    if (this.items.length && other.items.length && this.is3d !== other.is3d) fail('não é possível juntar gráficos 2D e 3D');
    return new Graphic([...this.items, ...other.items], { ...other.opts, ...this.opts });
  }
  display() {
    return { t: this.is3d ? 'graphics3d' : 'graphics', items: this.items, opts: this.opts };
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

// Pontos de controle: valor (objeto) → origem {id, index, sub?} do widget que o
// criou. Um primitivo gráfico que recebe o próprio valor torna o vértice
// arrastável; valores derivados (p + 1) são objetos novos e não arrastam.
export const HANDLE_OF = new WeakMap();

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
