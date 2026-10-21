// Renderiza estruturas de exibição (vindas do worker) em HTML.
// Gráficos e widgets viram "slots" preenchidos depois pela UI.

import { t } from './i18n.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻' };

export function ringName(s) {
  return esc(s)
    .replace(/\bZZ\b/g, 'ℤ').replace(/\bQQ\b/g, 'ℚ').replace(/\bRR\b/g, 'ℝ').replace(/\bCC\b/g, 'ℂ')
    .replace(/Zmod\((\d+)\)/g, 'ℤ/$1ℤ')
    .replace(/GF\((\d+)\^(\d+)\)/g, (_, p, k) => `𝔽<sub>${p}<sup>${k}</sup></sub>`)
    .replace(/GF\((\d+)\)/g, '𝔽<sub>$1</sub>')
    .replace(/\[(\w+)\]/g, '[<i>$1</i>]');
}

// "1.23e-45" -> 1.23·10⁻⁴⁵
function sci(s) {
  const m = /^(-?[\d.]+)e([+-]?\d+)$/.exec(s);
  if (!m) return esc(s);
  const exp = String(Number(m[2]));
  return `${esc(m[1])}·10<sup>${esc(exp.replace('-', '−'))}</sup>`;
}

function minus(s) {
  return s.replace(/^-/, '−');
}

export function render(d) {
  const slots = [];
  const html = r(d, slots, false);
  return { html, slots };
}

function isCompound(d) {
  if (d.t === 'poly') return d.terms.length > 1 || (d.terms.length === 1 && !(d.terms[0].c.t === 'int' && d.terms[0].c.s === '1') && d.terms[0].e > 0);
  if (d.t === 'gf') return isCompound(d.poly);
  if (d.t === 'cplx') return !d.imZero && !(d.re.mid === '0' && !d.re.rad);
  if (d.t === 'ball') return !!d.rad;
  return false;
}

function paren(d, slots) {
  const h = r(d, slots, true);
  return isCompound(d) ? `<span class="paren">(</span>${h}<span class="paren">)</span>` : h;
}

function ball(b) {
  if (!b.rad) return `<span class="n">${sci(minus(b.mid))}</span>`;
  if (b.zero) return `<span class="ball"><span class="rad">±${sci(b.rad)}</span></span>`;
  return `<span class="ball"><span class="n">${sci(minus(b.mid))}</span><span class="rad"> ± ${sci(b.rad)}</span></span>`;
}

function r(d, slots, inner) {
  switch (d.t) {
    case 'int': {
      if (d.full) {
        return `<span class="n bigint" title="${esc(t('digits', d.ndigits))}"><span class="trunc">${esc(minus(d.s))}</span>` +
          `<button class="expand" data-full="${esc(d.full)}">${esc(t('digits', d.ndigits))}</button></span>`;
      }
      return `<span class="n">${esc(minus(d.s))}</span>`;
    }
    case 'rat': {
      const neg = d.num.startsWith('-');
      const num = neg ? d.num.slice(1) : d.num;
      return `${neg ? '−' : ''}<span class="frac"><span class="fn">${esc(num)}</span><span class="fd">${esc(d.den)}</span></span>`;
    }
    case 'ball': return ball(d);
    case 'cplx': {
      if (d.imZero) return ball(d.re);
      const reZero = d.re.mid === '0' && !d.re.rad;
      const imNeg = !d.im.rad && d.im.mid.startsWith('-');
      const imAbs = imNeg ? { ...d.im, mid: d.im.mid.slice(1) } : d.im;
      const unitIm = !imAbs.rad && imAbs.mid === '1';
      const imH = unitIm ? '' : d.im.rad ? `<span class="paren">(</span>${ball(imAbs)}<span class="paren">)</span>` : ball(imAbs);
      const iPart = `${imH}<i class="imag">i</i>`;
      if (reZero) return (imNeg ? '−' : '') + iPart;
      return `${ball(d.re)}<span class="op">${imNeg ? '−' : '+'}</span>${iPart}`;
    }
    case 'gf': return r(d.poly, slots, inner);
    case 'poly': {
      if (!d.terms.length) return '<span class="n">0</span>';
      let out = '';
      d.terms.forEach(({ c, e }, k) => {
        let cd = c;
        let neg = false;
        if (!isCompound(c)) {
          if (c.t === 'int' && c.s.startsWith('-')) { neg = true; cd = { ...c, s: c.s.slice(1) }; }
          if (c.t === 'rat' && c.num.startsWith('-')) { neg = true; cd = { ...c, num: c.num.slice(1) }; }
          if (c.t === 'ball' && !c.rad && c.mid.startsWith('-')) { neg = true; cd = { ...c, mid: c.mid.slice(1) }; }
        }
        const one = cd.t === 'int' && cd.s === '1';
        const mon = e === 0 ? '' : `<i class="var">${esc(d.v)}</i>${e > 1 ? `<sup>${e}</sup>` : ''}`;
        let term;
        if (!mon) term = r(cd, slots, true);
        else if (one) term = mon;
        else term = paren(cd, slots) + '&#8202;' + mon;
        if (k === 0) out += (neg ? '−' : '') + term;
        else out += `<span class="op">${neg ? '−' : '+'}</span>${term}`;
      });
      if (d.more) out += '<span class="op">+</span>…';
      return `<span class="poly">${out}</span>`;
    }
    case 'mat': {
      const cells = d.rows.map((row) => row.map((x) => `<span class="mc">${r(x, slots, true)}</span>`).join('')).join('');
      const cols = d.rows[0]?.length ?? 0;
      const note = d.nrows > d.rows.length || d.ncols > cols ? `<span class="note">${d.nrows}×${d.ncols}</span>` : '';
      if (!d.nrows || !d.ncols) return `<span class="note">${esc(t('matrix', d.nrows, d.ncols))}</span>`;
      return `<span class="mat" style="--cols:${cols}"><span class="mgrid">${cells}</span></span>${note}`;
    }
    case 'list': {
      const items = d.items.map((x) => r(x, slots, true));
      const more = d.more ? `<span class="note">… +${d.more}</span>` : '';
      return `<span class="list"><span class="br">[</span>${items.join('<span class="sep">, </span>')}${more}<span class="br">]</span></span>`;
    }
    case 'tuple': {
      const items = d.items.map((x) => r(x, slots, true));
      return `<span class="tuple"><span class="br">(</span>${items.join('<span class="sep">, </span>')}${d.items.length === 1 ? ',' : ''}<span class="br">)</span></span>`;
    }
    case 'unit': return '<span class="note">()</span>';
    case 'factored': {
      const single = d.factors.length === 1 && d.factors[0].e === '1' && !d.unit;
      const fs = d.factors.map(({ b, e }) => (single ? r(b, slots, true) : paren(b, slots)) + (e === '1' ? '' : `<sup>${esc(minus(e))}</sup>`));
      if (d.unit) fs.unshift(paren(d.unit, slots));
      return `<span class="factored">${fs.join('<span class="op">·</span>') || '1'}</span>`;
    }
    case 'str': return inner ? `<span class="str">"${esc(d.s)}"</span>` : `<span class="text">${esc(d.s)}</span>`;
    case 'bool': return `<span class="bool">${d.v ? 'true' : 'false'}</span>`;
    case 'fn': return `<span class="fnv">ƒ${d.name ? ' ' + esc(d.name) : ''}${d.arity !== null && d.arity !== undefined ? `<span class="note">/${d.arity}</span>` : ''}</span>`;
    case 'ring': return `<span class="ring">${ringName(d.s)}</span>`;
    case 'graphics':
    case 'widget': {
      const k = slots.length;
      slots.push(d);
      return `<div class="slot" data-slot="${k}"></div>`;
    }
  }
  return `<span class="note">&lt;${esc(d.t)}&gt;</span>`;
}

export { esc, SUP };
