// Parser Pratt da linguagem Cauchy. Produz uma lista de declarações:
//   {k:'def', pat, expr} | {k:'fun', name, params, body} | expressão
// Nós de expressão têm {k, pos, end, ...}.

import { lex, CauchyError } from './lexer.js';

const BIN = {
  '|>': 1,
  or: 2, and: 3,
  '==': 5, '!=': 5, '<': 5, '<=': 5, '>': 5, '>=': 5,
  '..': 6,
  '+': 7, '-': 7,
  '*': 8, '/': 8, '//': 8, '%': 8, '∘': 8,
  '^': 10,
};
const UNARY_MINUS = 9;
const COMPARE = new Set(['==', '!=', '<', '<=', '>', '>=']);

export function parse(src) {
  return new Parser(src).program();
}

export function parseExpr(src) {
  const p = new Parser(src);
  const e = p.expr();
  p.expect('eof');
  return e;
}

class Parser {
  constructor(src) {
    this.toks = lex(src);
    this.i = 0;
  }

  get tok() { return this.toks[this.i]; }
  peek(k = 1) { return this.toks[Math.min(this.i + k, this.toks.length - 1)]; }
  next() { return this.toks[this.i++]; }

  is(v, t) {
    const tok = this.tok;
    if (t) return tok.t === t && (v === undefined || tok.v === v);
    return (tok.t === 'op' || tok.t === 'kw') && tok.v === v;
  }

  accept(v) {
    if (this.is(v)) return this.next();
    return null;
  }

  expect(v) {
    if (v === 'eof' ? this.tok.t === 'eof' : this.is(v)) return this.next();
    const got = this.tok.t === 'eof' ? 'fim da entrada' : this.tok.t === 'nl' ? 'quebra de linha' : `'${this.tok.v}'`;
    throw new CauchyError(`esperado '${v === 'eof' ? 'fim' : v}', encontrado ${got}`, this.tok.pos, this.tok.end);
  }

  error(msg, tok = this.tok) {
    throw new CauchyError(msg, tok.pos, tok.end);
  }

  skipSeps() {
    while (this.tok.t === 'nl' || this.is(';')) this.next();
  }

  program() {
    const stmts = [];
    this.skipSeps();
    while (this.tok.t !== 'eof') {
      stmts.push(this.statement());
      if (this.tok.t !== 'eof') {
        if (this.tok.t !== 'nl' && !this.is(';')) this.expect(';');
        this.skipSeps();
      }
    }
    return stmts;
  }

  // Declaração: `pat = expr`, `f(params) = expr` ou expressão.
  statement() {
    const start = this.tok.pos;
    const lhs = this.exprList();
    if (!this.is('=')) return lhs;
    this.next();
    const rhs = this.exprList();
    return this.makeDef(lhs, rhs, start);
  }

  // Lista separada por vírgulas no nível superior vira tupla: `a, b`.
  exprList() {
    const first = this.expr();
    if (!this.is(',')) return first;
    const items = [first];
    while (this.accept(',')) items.push(this.expr());
    return { k: 'tuple', items, pos: first.pos, end: items[items.length - 1].end };
  }

  makeDef(lhs, rhs, start) {
    const end = rhs.end;
    if (lhs.k === 'call' && lhs.fn.k === 'var') {
      if (lhs.kwargs.length) this.errorAt('argumentos nomeados não são permitidos em definições', lhs);
      return { k: 'fun', name: lhs.fn.name, params: lhs.args.map((a) => this.toPattern(a)), body: rhs, pos: start, end };
    }
    return { k: 'def', pat: this.toPattern(lhs), expr: rhs, pos: start, end };
  }

  errorAt(msg, node) {
    throw new CauchyError(msg, node.pos, node.end);
  }

  toPattern(e) {
    switch (e.k) {
      case 'var':
        return e.name === '_' ? { k: 'pwild', pos: e.pos, end: e.end } : { k: 'pvar', name: e.name, pos: e.pos, end: e.end };
      case 'num': case 'dec': case 'str': case 'bool':
        return { k: 'plit', lit: e, pos: e.pos, end: e.end };
      case 'un':
        if (e.op === '-' && (e.e.k === 'num' || e.e.k === 'dec')) return { k: 'plit', lit: e, pos: e.pos, end: e.end };
        break;
      case 'tuple':
        return { k: 'ptuple', items: e.items.map((x) => this.toPattern(x)), pos: e.pos, end: e.end };
      case 'list': {
        const items = [];
        let rest = null;
        e.items.forEach((x, j) => {
          if (x.k === 'spread') {
            if (j !== e.items.length - 1) this.errorAt('"..." só pode aparecer no fim de um padrão de lista', x);
            rest = this.toPattern(x.e);
          } else items.push(this.toPattern(x));
        });
        return { k: 'plist', items, rest, pos: e.pos, end: e.end };
      }
    }
    this.errorAt('padrão inválido', e);
  }

  expr() {
    const t = this.tok;
    if (t.t === 'kw') {
      switch (t.v) {
        case 'let': return this.letExpr();
        case 'if': return this.ifExpr();
        case 'match': return this.matchExpr();
        case 'with': return this.withExpr();
      }
    }
    const lhs = this.binary(0);
    if (this.is('->')) {
      this.next();
      const params = lhs.k === 'tuple' && !lhs.paren1 ? lhs.items : [lhs];
      const body = this.expr();
      return { k: 'lambda', params: params.map((p) => this.toPattern(p)), body, pos: lhs.pos, end: body.end };
    }
    return lhs;
  }

  letExpr() {
    const start = this.next().pos;
    const binds = [];
    for (;;) {
      this.skipSeps();
      if (this.is('in')) break;
      const s = this.tok.pos;
      const lhs = this.binary(0);
      this.expect('=');
      const rhs = this.expr();
      binds.push(this.makeDef(lhs, rhs, s));
      if (this.accept(',')) continue;
      if (this.tok.t === 'nl' || this.is(';')) continue;
      break;
    }
    this.expect('in');
    const body = this.expr();
    return { k: 'let', binds, body, pos: start, end: body.end };
  }

  ifExpr() {
    const start = this.next().pos;
    const c = this.expr();
    this.expect('then');
    const a = this.expr();
    this.expect('else');
    const b = this.expr();
    return { k: 'if', c, a, b, pos: start, end: b.end };
  }

  matchExpr() {
    const start = this.next().pos;
    const e = this.binary(0);
    this.expect('{');
    const arms = [];
    for (;;) {
      while (this.tok.t === 'nl' || this.is(';') || this.is(',')) this.next();
      if (this.is('}')) break;
      const pat = this.toPattern(this.binary(0));
      let guard = null;
      if (this.accept('if')) guard = this.binary(0);
      this.expect('=>');
      const body = this.expr();
      arms.push({ pat, guard, body });
    }
    const end = this.expect('}').end;
    return { k: 'match', e, arms, pos: start, end };
  }

  withExpr() {
    const start = this.next().pos;
    const opts = [];
    do {
      const name = this.expect_id();
      this.expect('=');
      opts.push({ name: name.v, expr: this.binary(0) });
    } while (this.accept(','));
    if (!this.accept(':')) this.expect('in');
    const body = this.expr();
    return { k: 'with', opts, body, pos: start, end: body.end };
  }

  expect_id() {
    if (this.tok.t !== 'id') this.error('esperado um nome');
    return this.next();
  }

  binary(minPrec) {
    let lhs = this.unary();
    for (;;) {
      const t = this.tok;
      if (t.t !== 'op' && t.t !== 'kw') break;
      const prec = BIN[t.v];
      if (prec === undefined || prec < minPrec) break;
      this.next();
      if (t.v === '|>') {
        lhs = this.pipe(lhs, this.binary(prec + 1));
      } else if (t.v === '..') {
        const to = this.binary(prec + 1);
        let step = null;
        if (this.accept('by')) step = this.binary(prec + 1);
        lhs = { k: 'range', from: lhs, to, step, pos: lhs.pos, end: (step ?? to).end };
      } else if (COMPARE.has(t.v)) {
        // Comparações encadeadas: a < b <= c
        const ops = [t.v];
        const args = [lhs, this.binary(prec + 1)];
        while (COMPARE.has(this.tok.v) && (this.tok.t === 'op')) {
          ops.push(this.next().v);
          args.push(this.binary(prec + 1));
        }
        const end = args[args.length - 1].end;
        lhs = ops.length === 1
          ? { k: 'bin', op: ops[0], l: args[0], r: args[1], pos: lhs.pos, end }
          : { k: 'chain', ops, args, pos: lhs.pos, end };
      } else {
        // '^' é associativo à direita; os demais, à esquerda.
        const rhs = this.binary(t.v === '^' ? prec : prec + 1);
        lhs = { k: 'bin', op: t.v, l: lhs, r: rhs, pos: lhs.pos, end: rhs.end };
      }
    }
    return lhs;
  }

  pipe(lhs, rhs) {
    if (rhs.k === 'call' && !rhs.paren) {
      return { ...rhs, args: [lhs, ...rhs.args], pos: lhs.pos };
    }
    return { k: 'call', fn: rhs, args: [lhs], kwargs: [], pos: lhs.pos, end: rhs.end };
  }

  unary() {
    const t = this.tok;
    if (this.is('-') || this.is('+')) {
      this.next();
      const e = this.binary(UNARY_MINUS);
      if (t.v === '+') return e;
      return { k: 'un', op: '-', e, pos: t.pos, end: e.end };
    }
    if (this.is('not')) {
      this.next();
      const e = this.binary(4);
      return { k: 'un', op: 'not', e, pos: t.pos, end: e.end };
    }
    if (this.is('√')) {
      this.next();
      const e = this.unary();
      return { k: 'call', fn: { k: 'var', name: 'sqrt', pos: t.pos, end: t.end }, args: [e], kwargs: [], pos: t.pos, end: e.end };
    }
    return this.postfix(this.primary());
  }

  postfix(e) {
    for (;;) {
      if (this.is('(') ) {
        this.next();
        const { args, kwargs } = this.callArgs();
        const end = this.expect(')').end;
        e = { k: 'call', fn: e, args, kwargs, pos: e.pos, end };
      } else if (this.is('[')) {
        this.next();
        const idx = [];
        const kwargs = [];
        if (!this.is(']')) {
          do {
            // R[x, y, order = "lex"]: opções nomeadas no fim.
            if (this.tok.t === 'id' && this.peek().t === 'op' && this.peek().v === '=') {
              const name = this.next().v;
              this.next();
              kwargs.push({ name, expr: this.expr() });
            } else {
              if (kwargs.length) this.error('índice após opção nomeada');
              idx.push(this.expr());
            }
          } while (this.accept(','));
        }
        const end = this.expect(']').end;
        e = { k: 'index', obj: e, idx, kwargs, pos: e.pos, end };
      } else if (this.is('!')) {
        const end = this.next().end;
        e = { k: 'call', fn: { k: 'var', name: 'factorial', pos: e.pos, end }, args: [e], kwargs: [], pos: e.pos, end };
      } else if (this.is('.') && this.peek().t === 'id') {
        this.next();
        const name = this.next();
        e = { k: 'field', obj: e, name: name.v, pos: e.pos, end: name.end };
      } else return e;
    }
  }

  callArgs() {
    const args = [];
    const kwargs = [];
    if (this.is(')')) return { args, kwargs };
    do {
      if (this.is(')')) break;
      if (this.tok.t === 'id' && this.peek().t === 'op' && this.peek().v === '=') {
        const name = this.next().v;
        this.next();
        kwargs.push({ name, expr: this.expr() });
      } else {
        if (kwargs.length) this.error('argumento posicional após argumento nomeado');
        args.push(this.spreadOrExpr());
      }
    } while (this.accept(','));
    return { args, kwargs };
  }

  spreadOrExpr() {
    if (this.is('...')) {
      const t = this.next();
      const e = this.expr();
      return { k: 'spread', e, pos: t.pos, end: e.end };
    }
    return this.expr();
  }

  primary() {
    const t = this.tok;
    switch (t.t) {
      case 'num': this.next(); return { k: 'num', v: t.v, pos: t.pos, end: t.end };
      case 'dec': this.next(); return { k: 'dec', v: t.v, pos: t.pos, end: t.end };
      case 'str': this.next(); return { k: 'str', v: t.v, pos: t.pos, end: t.end };
      case 'id': this.next(); return { k: 'var', name: t.v === 'π' ? 'pi' : t.v, pos: t.pos, end: t.end };
      case 'kw':
        if (t.v === 'true' || t.v === 'false') {
          this.next();
          return { k: 'bool', v: t.v === 'true', pos: t.pos, end: t.end };
        }
        if (['let', 'if', 'match', 'with'].includes(t.v)) return this.expr();
        break;
      case 'op':
        if (t.v === '(') return this.parenExpr();
        if (t.v === '[') return this.listExpr();
        break;
    }
    if (t.t === 'eof') this.error('expressão incompleta');
    this.error(`token inesperado '${t.v === '\n' ? '↵' : t.v}'`);
  }

  parenExpr() {
    const start = this.next().pos;
    if (this.is(')')) {
      const end = this.next().end;
      return { k: 'tuple', items: [], pos: start, end };
    }
    const first = this.spreadOrExpr();
    if (this.is(')')) {
      const end = this.next().end;
      if (first.k === 'spread') return { k: 'tuple', items: [first], pos: start, end };
      // Marca parênteses para distinguir (a < b) < c e (f(x)) |> g.
      return { ...first, paren: true, paren1: first.k === 'tuple' };
    }
    const items = [first];
    while (this.accept(',')) {
      if (this.is(')')) break;
      items.push(this.spreadOrExpr());
    }
    const end = this.expect(')').end;
    return { k: 'tuple', items, pos: start, end };
  }

  listExpr() {
    const start = this.next().pos;
    if (this.is(']')) {
      const end = this.next().end;
      return { k: 'list', items: [], pos: start, end };
    }
    const first = this.spreadOrExpr();
    if (this.is('|')) {
      this.next();
      const clauses = [];
      do {
        const c = this.expr();
        if (this.accept('<-')) {
          clauses.push({ k: 'gen', pat: this.toPattern(c), src: this.expr() });
        } else clauses.push({ k: 'filter', cond: c });
      } while (this.accept(','));
      const end = this.expect(']').end;
      return { k: 'comp', expr: first, clauses, pos: start, end };
    }
    const rows = [[first]];
    let matrix = false;
    for (;;) {
      if (this.accept(',')) {
        if (this.is(']')) break;
        rows[rows.length - 1].push(this.spreadOrExpr());
      } else if (this.accept(';')) {
        matrix = true;
        if (this.is(']')) break;
        rows.push([this.spreadOrExpr()]);
      } else break;
    }
    const end = this.expect(']').end;
    if (!matrix) {
      return { k: 'list', items: rows[0], pos: start, end };
    }
    return { k: 'matrix', rows, pos: start, end };
  }
}
