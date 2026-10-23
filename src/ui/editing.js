// Edição no editor de células, em funções puras sobre (texto, seleção):
// fechamento de delimitadores, indentação, palavra sob o cursor para
// autocompletar e a chamada que envolve o cursor (para mostrar a assinatura).
// Cada edição devolve {text, start, end, sel: [a, b]}: substituir
// src[start, end) por text e deixar a seleção em [a, b], ou null.

const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"' };
const CLOSERS = new Set([')', ']', '}']);
const WORD = /[\p{L}\p{N}_']/u;

// Contexto em pos: dentro de string, de comentário ou código.
export function contextAt(src, pos) {
  let str = false;
  for (let k = 0; k < pos; k++) {
    const ch = src[k];
    if (str) {
      if (ch === '\\') k++;
      else if (ch === '"') str = false;
      else if (ch === '\n') str = false;
    } else if (ch === '"') str = true;
    else if (ch === '#') {
      const nl = src.indexOf('\n', k);
      if (nl < 0 || nl >= pos) return 'comment';
      k = nl;
    }
  }
  return str ? 'string' : 'code';
}

// Digitação de ch com a seleção [s, e).
export function typeChar(src, s, e, ch) {
  const ctx = contextAt(src, s);
  if (ctx === 'comment') return null;
  // Com seleção, delimitadores de abertura envolvem o trecho.
  if (s !== e && PAIRS[ch] && ctx === 'code') {
    return { text: ch + src.slice(s, e) + PAIRS[ch], start: s, end: e, sel: [s + 1, e + 1] };
  }
  if (s !== e) return null;
  const next = src[s] ?? '';
  // Fechamento já presente: só avança.
  if ((CLOSERS.has(ch) && next === ch && ctx === 'code') || (ch === '"' && next === '"' && ctx === 'string')) {
    return { text: '', start: s, end: s, sel: [s + 1, s + 1] };
  }
  if (ctx !== 'code' || !PAIRS[ch]) return null;
  // Abre o par só antes de espaço, fim, fechamento ou separador.
  if (next && !/[\s)\]},;]/.test(next)) return null;
  if (ch === '"' && WORD.test(src[s - 1] ?? '')) return null;
  return { text: ch + PAIRS[ch], start: s, end: s, sel: [s + 1, s + 1] };
}

// Backspace entre um par vazio apaga os dois.
export function backspace(src, s, e) {
  if (s !== e || s === 0) return null;
  const open = src[s - 1];
  if (!PAIRS[open] || src[s] !== PAIRS[open]) return null;
  if (contextAt(src, s - 1) !== 'code') return null;
  return { text: '', start: s - 1, end: s + 1, sel: [s - 1, s - 1] };
}

// Enter mantém a indentação da linha; entre um par aberto, indenta mais e
// leva o fechamento para a linha seguinte.
export function newline(src, s, e, unit = '  ') {
  const lineStart = src.lastIndexOf('\n', s - 1) + 1;
  const indent = /^[ \t]*/.exec(src.slice(lineStart, s))[0];
  const before = src.slice(lineStart, s).trimEnd().slice(-1);
  const after = src.slice(e).match(/^[ \t]*(.?)/)[1];
  if (PAIRS[before] && before !== '"' && after === PAIRS[before]) {
    const inner = '\n' + indent + unit;
    return { text: inner + '\n' + indent, start: s, end: e, sel: [s + inner.length, s + inner.length] };
  }
  if (PAIRS[before] && before !== '"') {
    const text = '\n' + indent + unit;
    return { text, start: s, end: e, sel: [s + text.length, s + text.length] };
  }
  const text = '\n' + indent;
  return { text, start: s, end: e, sel: [s + text.length, s + text.length] };
}

// Palavra (identificador) que termina no cursor: {word, start}, ou null.
export function wordBefore(src, pos) {
  let a = pos;
  while (a > 0 && WORD.test(src[a - 1])) a--;
  if (a === pos || /\p{N}/u.test(src[a])) return null;
  if (contextAt(src, a) !== 'code') return null;
  return { word: src.slice(a, pos), start: a };
}

// Identificadores do texto (para sugerir nomes definidos no caderno).
export function identifiers(src) {
  const out = new Set();
  const re = /("(?:\\.|[^"\\\n])*"?)|(#[^\n]*)|([\p{L}_][\p{L}\p{N}_']*)/gu;
  let m;
  while ((m = re.exec(src))) if (m[3]) out.add(m[3]);
  return out;
}

// Sugestões para o prefixo: primeiro as que começam com ele (com a mesma
// caixa antes), depois as que o contêm; nomes mais curtos antes.
export function complete(prefix, names, limit = 12) {
  const p = prefix.toLowerCase();
  const exact = [], starts = [], inner = [];
  for (const n of names) {
    if (n === prefix) continue;
    const l = n.toLowerCase();
    if (n.startsWith(prefix)) exact.push(n);
    else if (l.startsWith(p)) starts.push(n);
    else if (p.length >= 2 && l.includes(p)) inner.push(n);
  }
  const order = (a, b) => a.length - b.length || a.localeCompare(b);
  return [...exact.sort(order), ...starts.sort(order), ...inner.sort(order)].slice(0, limit);
}

// Chamada f( … ) aberta que contém o cursor: {name, arg} com o índice do
// argumento corrente (a partir de 0), ou null.
export function callAt(src, pos) {
  let depth = 0, arg = 0;
  for (let k = pos - 1; k >= 0; k--) {
    const ch = src[k];
    if (ch === '\n' && depth === 0 && src[k - 1] !== ',' && src[k - 1] !== '(') {
      // Linha anterior sem continuação: a chamada não passa daqui.
      const prev = src.slice(0, k).trimEnd().slice(-1);
      if (prev && !',(['.includes(prev)) return null;
    }
    if (')]}'.includes(ch)) depth++;
    else if ('([{'.includes(ch)) {
      if (depth > 0) { depth--; continue; }
      if (ch !== '(') { arg = 0; continue; }
      let b = k;
      while (b > 0 && WORD.test(src[b - 1])) b--;
      const name = src.slice(b, k);
      if (!name || /\p{N}/u.test(name[0])) return null;
      if (contextAt(src, b) !== 'code') return null;
      return { name, arg };
    } else if (ch === ',' && depth === 0) arg++;
  }
  return null;
}
