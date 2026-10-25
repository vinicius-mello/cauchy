import { test } from 'node:test';
import assert from 'node:assert/strict';
import { symbolAt } from '../src/ui/highlight.js';

test('symbolAt troca só operadores, fora de strings e comentários', () => {
  assert.equal(symbolAt('f = t ->', 8), '→');
  assert.equal(symbolAt('[k | k <-', 9), '←');
  assert.equal(symbolAt('match x { 1 =>', 14), '⇒');
  assert.equal(symbolAt('xs |>', 5), '▷');
  assert.equal(symbolAt('x -->', 5), '→');
  assert.equal(symbolAt('a ==>', 5), null);
  assert.equal(symbolAt('"a ->', 5), null);
  assert.equal(symbolAt('# t ->', 6), null);
  assert.equal(symbolAt('f(t ->)', 6), '→');
  assert.equal(symbolAt('a - b', 3), null);
  assert.equal(symbolAt('x <=', 4), '≤');
  assert.equal(symbolAt('x >=', 4), '≥');
  assert.equal(symbolAt('x !=', 4), '≠');
  assert.equal(symbolAt('x ==', 4), null);
  assert.equal(symbolAt('"x <=', 5), null);
});

import { typeChar, backspace, newline, wordBefore, identifiers, complete, callAt, contextAt } from '../src/ui/editing.js';

// Aplica uma edição e marca o cursor com |.
const apply = (src, r) => {
  const out = src.slice(0, r.start) + r.text + src.slice(r.end);
  return out.slice(0, r.sel[0]) + '|' + out.slice(r.sel[0]);
};

test('delimitadores: fecha, envolve a seleção, pula o fechamento e apaga o par', () => {
  assert.equal(apply('f', typeChar('f', 1, 1, '(')), 'f(|)');
  assert.equal(apply('x = ', typeChar('x = ', 4, 4, '[')), 'x = [|]');
  assert.equal(apply('f()', typeChar('f()', 2, 2, ')')), 'f()|');
  assert.equal(apply('a + b', typeChar('a + b', 0, 5, '(')), '(|a + b)');
  assert.equal(typeChar('fx', 1, 1, '('), null); // antes de uma palavra
  assert.equal(typeChar('# f', 3, 3, '('), null); // comentário
  assert.equal(typeChar('"a', 2, 2, '('), null); // string
  assert.equal(apply('', typeChar('', 0, 0, '"')), '"|"');
  assert.equal(apply('""', typeChar('""', 1, 1, '"')), '""|');
  assert.equal(typeChar('ab', 2, 2, '"'), null);
  assert.equal(apply('f()', backspace('f()', 2, 2)), 'f|');
  assert.equal(backspace('f(x)', 3, 3), null);
});

test('Enter mantém e aumenta a indentação', () => {
  assert.equal(apply('  x', newline('  x', 3, 3)), '  x\n  |');
  assert.equal(apply('match x {}', newline('match x {}', 9, 9)), 'match x {\n  |\n}');
  assert.equal(apply('f(', newline('f(', 2, 2)), 'f(\n  |');
});

test('autocompletar: palavra sob o cursor e ordem das sugestões', () => {
  assert.deepEqual(wordBefore('x = fac', 7), { word: 'fac', start: 4 });
  assert.equal(wordBefore('x = 12', 6), null);
  assert.equal(wordBefore('"fac', 4), null);
  assert.deepEqual([...identifiers('f(x) = x + 1 # comentário\n"str"')], ['f', 'x']);
  assert.deepEqual(complete('fa', ['factorial', 'factor', 'fa', 'isfactor', 'sin']), ['factor', 'factorial', 'isfactor']);
  assert.deepEqual(complete('n', ['N', 'nops', 'nu']), ['nu', 'nops', 'N']);
  assert.equal(contextAt('"a # b" + 1', 9), 'code');
  assert.equal(contextAt('x # "a', 6), 'comment');
});

test('assinatura: chamada e argumento corrente', () => {
  assert.deepEqual(callAt('slider(1, 10', 12), { name: 'slider', arg: 1 });
  assert.deepEqual(callAt('f(g(1, 2), [3, 4], ', 19), { name: 'f', arg: 2 });
  assert.deepEqual(callAt('f([1, 2', 7), { name: 'f', arg: 0 });
  assert.equal(callAt('(1, 2', 5), null);
  assert.equal(callAt('f(1)', 4), null);
});

test('expoentes sobrescritos não fazem parte de identificadores', () => {
  assert.equal(wordBefore('x²', 2), null);
  assert.deepEqual(wordBefore('x²+ab', 5), { word: 'ab', start: 3 });
  assert.deepEqual([...identifiers('x² + y₁³')], ['x', 'y₁']);
});
