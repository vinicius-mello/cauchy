import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { init, Notebook, toText } from './harness.mjs';

let F;
before(async () => { F = await init(); });

const show = (r) => (r.status === 'error' ? `ERRO: ${r.error.message}` : r.display ? toText(r.display) : '');
const byId = (res) => Object.fromEntries(res.map((r) => [r.id, show(r)]));

test('reavalia apenas dependentes, em ordem topológica', () => {
  const nb = new Notebook();
  let res = nb.update([
    { id: 'b', src: 'b = a + 1' },
    { id: 'a', src: 'a = 10' },
    { id: 'c', src: 'c = 100' },
    { id: 'd', src: 'b * 2' },
  ]);
  assert.deepEqual(res.map((r) => r.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(byId(res), { a: '10', b: '11', c: '100', d: '22' });
  res = nb.update([{ id: 'a', src: 'a = 20' }]);
  assert.deepEqual(res.map((r) => r.id), ['a', 'b', 'd']);
  assert.deepEqual(byId(res), { a: '20', b: '21', d: '42' });
});

test('anel de polinômios e gerador em células separadas (dependência fraca)', () => {
  const nb = new Notebook();
  const res = nb.update([
    { id: 'r', src: 'R = QQ[x]' },
    { id: 'x', src: 'x = gen(R)' },
    { id: 'p', src: 'p = (x + 1)^2' },
  ]);
  assert.deepEqual(byId(res), { r: 'QQ[x]', x: 'x', p: 'x^2 + 2*x + 1' });
});

test('ciclos e definições duplicadas são erros', () => {
  const nb = new Notebook();
  let res = nb.update([{ id: 'a', src: 'a = b + 1' }, { id: 'b', src: 'b = a + 1' }]);
  assert.match(byId(res).a, /dependência circular/);
  res = nb.update([{ id: 'c', src: 'z = 1' }, { id: 'd', src: 'z = 2' }]);
  assert.match(byId(res).c, /mais de uma célula/);
  res = nb.update([{ id: 'd', src: 'w = 2' }]);
  assert.equal(byId(res).c, '1');
});

test('erro propaga para dependentes e se recupera', () => {
  const nb = new Notebook();
  let res = nb.update([{ id: 'a', src: 'a = 1/0' }, { id: 'b', src: 'b = a + 1' }]);
  assert.match(byId(res).b, /depende de célula com erro/);
  res = nb.update([{ id: 'a', src: 'a = 1/2' }]);
  assert.equal(byId(res).b, '3/2');
});

test('memória: handles vivos voltam ao nível base', () => {
  const nb = new Notebook();
  const base = F.live;
  nb.update([
    { id: 'a', src: 'xs = [k^2 | k <- 1..200]' },
    { id: 'b', src: 's = sum(xs)' },
    { id: 'c', src: 'f(t) = t * s; f(3)' },
    { id: 'd', src: 'with prec = 500: [zeta(k) | k <- 2..20]' },
  ]);
  const held = F.live - base;
  // xs (200) + s (1) + closures + resultado de c... não deve guardar temporários.
  assert.ok(held < 260, `vivos: ${held}`);
  for (let i = 0; i < 5; i++) nb.update([{ id: 'a', src: `xs = [k^2 | k <- 1..${200 + i}]` }]);
  assert.ok(F.live - base < 270, `vivos após reavaliações: ${F.live - base}`);
  nb.update(['a', 'b', 'c', 'd'].map((id) => ({ id, src: null })));
  assert.equal(F.live, base);
});

test('widgets: valor vem do estado da célula', () => {
  const nb = new Notebook();
  let res = nb.update([{ id: 'k', src: 'k = slider(1, 10)' }, { id: 'sq', src: 'k^2' }]);
  assert.equal(byId(res).sq, '1');
  assert.equal(res[0].display.t, 'widget');
  res = nb.setWidget('k', 0, 7);
  assert.equal(byId(res).sq, '49');
});

test('gráfico produz séries de pontos', () => {
  const nb = new Notebook();
  const [r] = nb.update([{ id: 'p', src: 'plot(t -> sin(t), 0, 3, points = 10)' }]);
  assert.equal(r.display.t, 'plot');
  assert.equal(r.display.series[0].points.length, 11);
  assert.ok(Math.abs(r.display.series[0].points[5][1] - Math.sin(1.5)) < 1e-12);
});
