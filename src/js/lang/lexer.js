// Lexer da linguagem Cauchy.
// Produz tokens {t, v, pos, end}; t ∈ num, dec, str, id, op, kw, nl, eof.

export class CauchyError extends Error {
  constructor(msg, pos, end) {
    super(msg);
    this.pos = pos;
    this.end = end ?? pos;
  }
}

const KEYWORDS = new Set([
  'let', 'in', 'if', 'then', 'else', 'match', 'with', 'and', 'or', 'not',
  'true', 'false', 'for', 'by',
]);

// Ordenados do mais longo para o mais curto.
const OPS = [
  '...', '|>', '->', '=>', '<-', '==', '!=', '<=', '>=', '..', '//',
  '+', '-', '*', '/', '^', '%', '!', '=', '<', '>', '(', ')', '[', ']',
  '{', '}', ',', ';', ':', '|', '.',
];

const UNICODE_OPS = {
  '≤': '<=', '≥': '>=', '≠': '!=', '→': '->', '←': '<-', '⇒': '=>', '▷': '|>', '·': '*', '×': '*',
  '−': '-', '÷': '/', '∘': '∘', '√': '√', '…': '...',
};

const isIdStart = (c) => /[\p{L}_]/u.test(c);
const isIdPart = (c) => /[\p{L}\p{N}_']/u.test(c);
const isDigit = (c) => c >= '0' && c <= '9';

// Tokens após os quais uma quebra de linha não termina a expressão.
const CONTINUES_AFTER = new Set([
  '+', '-', '*', '/', '^', '%', '//', '=', '==', '!=', '<', '<=', '>', '>=',
  '|>', '->', '=>', '<-', '..', '(', '[', '{', ',', '|', ':', 'and', 'or',
  'not', 'in', 'then', 'else', 'let', 'if', '∘', '√',
]);
// Tokens antes dos quais uma quebra de linha não termina a expressão.
const CONTINUES_BEFORE = new Set([
  '|>', 'in', 'then', 'else', ')', ']', '}', '..', 'and', 'or', '=>', '∘',
]);

export function lex(src) {
  const toks = [];
  let i = 0;
  // Pilha de delimitadores abertos: quebras de linha só contam fora de () e [].
  const stack = [];
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '\n') {
      const top = stack[stack.length - 1];
      if (top === undefined || top === '{') toks.push({ t: 'nl', v: '\n', pos: i, end: i + 1 });
      i++;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '#') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    const start = i;
    if (isDigit(c)) {
      while (i < n && (isDigit(src[i]) || src[i] === '_')) i++;
      let t = 'num';
      // Parte decimal: "1.5" mas não "1..5".
      if (src[i] === '.' && isDigit(src[i + 1] ?? '')) {
        t = 'dec';
        i++;
        while (i < n && (isDigit(src[i]) || src[i] === '_')) i++;
      }
      if ((src[i] === 'e' || src[i] === 'E') &&
          (isDigit(src[i + 1] ?? '') || ((src[i + 1] === '-' || src[i + 1] === '+') && isDigit(src[i + 2] ?? '')))) {
        t = 'dec';
        i += 2;
        while (i < n && isDigit(src[i])) i++;
      }
      toks.push({ t, v: src.slice(start, i).replaceAll('_', ''), pos: start, end: i });
      // Multiplicação implícita: 2x, 3(x+1), 2π
      if (i < n && (isIdStart(src[i]) || src[i] === '(') && !/^[eE]\d/.test(src.slice(i))) {
        toks.push({ t: 'op', v: '*', pos: i, end: i, implicit: true });
      }
      continue;
    }
    if (isIdStart(c)) {
      while (i < n && isIdPart(src[i])) i++;
      const v = src.slice(start, i);
      toks.push({ t: KEYWORDS.has(v) ? 'kw' : 'id', v, pos: start, end: i });
      continue;
    }
    if (c === '"') {
      i++;
      let s = '';
      while (i < n && src[i] !== '"') {
        if (src[i] === '\\') {
          const e = src[i + 1];
          s += e === 'n' ? '\n' : e === 't' ? '\t' : e;
          i += 2;
        } else s += src[i++];
      }
      if (i >= n) throw new CauchyError('string não terminada', start, i);
      i++;
      toks.push({ t: 'str', v: s, pos: start, end: i });
      continue;
    }
    if (UNICODE_OPS[c]) {
      toks.push({ t: 'op', v: UNICODE_OPS[c], pos: i, end: i + 1 });
      i++;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new CauchyError(`caractere inesperado '${c}'`, i, i + 1);
    if (op === '(' || op === '[' || op === '{') stack.push(op);
    if (op === ')' || op === ']' || op === '}') stack.pop();
    toks.push({ t: 'op', v: op, pos: i, end: i + op.length });
    i += op.length;
  }
  toks.push({ t: 'eof', v: '', pos: n, end: n });

  // Remove quebras de linha redundantes ou que continuam uma expressão.
  const out = [];
  for (let k = 0; k < toks.length; k++) {
    const tok = toks[k];
    if (tok.t === 'nl') {
      const prev = out[out.length - 1];
      let j = k + 1;
      while (toks[j].t === 'nl') j++;
      const next = toks[j];
      if (!prev || prev.t === 'nl' || next.t === 'eof') continue;
      if ((prev.t === 'op' || prev.t === 'kw') && CONTINUES_AFTER.has(prev.v)) continue;
      if ((next.t === 'op' || next.t === 'kw') && CONTINUES_BEFORE.has(next.v)) continue;
    }
    out.push(tok);
  }
  return out;
}
