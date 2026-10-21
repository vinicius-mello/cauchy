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
