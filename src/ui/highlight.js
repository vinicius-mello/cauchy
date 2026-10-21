// Realce de sintaxe para o editor (camada <pre> sob o <textarea>).

import { esc } from './render.js';

const KEYWORDS = new Set(['let', 'in', 'if', 'then', 'else', 'match', 'with', 'and', 'or', 'not', 'true', 'false', 'by']);
const RINGS = new Set(['ZZ', 'QQ', 'RR', 'CC', 'ℤ', 'ℚ', 'ℝ', 'ℂ']);

const TOKEN = /(#[^\n]*)|("(?:\\.|[^"\\])*"?)|(\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)|([\p{L}_][\p{L}\p{N}_']*)|(\|>|->|=>|<-|==|!=|<=|>=|\.\.\.|\.\.|\/\/|[-+*/^%!=<>|∘√·×≤≥≠→←⇒▷])|(\s+)|(.)/gsu;

export function highlight(src, builtins = new Set(), err = null) {
  const segs = [];
  let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(src))) {
    const [text] = m;
    let cls = null;
    if (m[1]) cls = 'c';
    else if (m[2]) cls = 's';
    else if (m[3]) cls = 'num';
    else if (m[4]) {
      const after = src.slice(TOKEN.lastIndex).match(/^\s*(\(|=(?!=))/);
      if (KEYWORDS.has(text)) cls = 'kw';
      else if (RINGS.has(text)) cls = 'ring';
      else if (after && after[1] === '(' && builtins.has(text)) cls = 'bi';
      else if (after && after[1] === '(') cls = 'call';
      else if (builtins.has(text)) cls = 'bi';
    } else if (m[5]) cls = 'op';
    segs.push({ start: m.index, end: m.index + text.length, cls });
  }
  let out = '';
  const e0 = err ? err.pos : -1;
  const e1 = err ? Math.max(err.end ?? err.pos + 1, err.pos + 1) : -1;
  for (const s of segs) {
    // Divide o segmento nos limites do trecho com erro.
    const cuts = [s.start, s.end];
    if (e0 > s.start && e0 < s.end) cuts.push(e0);
    if (e1 > s.start && e1 < s.end) cuts.push(e1);
    cuts.sort((a, b) => a - b);
    for (let k = 0; k + 1 < cuts.length; k++) {
      const a = cuts[k], b = cuts[k + 1];
      if (a === b) continue;
      let h = esc(src.slice(a, b));
      if (s.cls) h = `<span class="t-${s.cls}">${h}</span>`;
      if (err && a >= e0 && b <= e1) h = `<span class="t-err">${h}</span>`;
      out += h;
    }
  }
  // Erro no fim da entrada: marca um espaço.
  if (err && e0 >= src.length) out += '<span class="t-err"> </span>';
  return out + '\n';
}

// Digitação de símbolos: o par ASCII que termina em `end` vira o caractere
// Unicode correspondente, se for de fato esse operador (não está em string
// ou comentário, nem faz parte de outro token).
const SYMBOLS = { '->': '→', '<-': '←', '=>': '⇒', '|>': '▷', '<=': '≤', '>=': '≥', '!=': '≠' };

export function symbolAt(src, end) {
  const pair = src.slice(end - 2, end);
  if (!SYMBOLS[pair]) return null;
  TOKEN.lastIndex = 0;
  let m;
  while ((m = TOKEN.exec(src))) {
    if (m.index >= end) break;
    if (m.index === end - 2 && m[0] === pair && m[5]) return SYMBOLS[pair];
  }
  return null;
}
