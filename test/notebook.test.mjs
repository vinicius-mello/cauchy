import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { init, Notebook, toText } from './harness.mjs';

let F;
before(async () => { F = await init(); });

const show = (r) => (r.status === 'error' ? `ERRO: ${r.error.message}` : r.display ? toText(r.display) : '');
const byId = (res) => Object.fromEntries(res.map((r) => [r.id, show(r)]));
const byIdDisplay = (res) => Object.fromEntries(res.map((r) => [r.id, r.display]));

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

test('memória: polinômios em várias variáveis não deixam handles vivos', () => {
  const nb = new Notebook();
  const base = F.live;
  nb.update([
    { id: 'a', src: '(x, y, z) = gens(QQ[x, y, z])' },
    { id: 'b', src: 'p = (x + y + z)^6 - 1' },
    { id: 'c', src: 'factor(p), gcd(p, p*x), subs(p, x = y^2), p(1, 2, RR(3)), divrem(p, [x*y - 1, z^2])' },
    { id: 'd', src: 'r = resultant(x^2 + y^2 - 1, x - y, y); roots(r), terms(r), diff(p, z, 2)' },
  ]);
  const held = F.live - base;
  assert.ok(held < 60, `vivos: ${held}`);
  for (let i = 2; i < 6; i++) nb.update([{ id: 'b', src: `p = (x + y + z)^${i} - 1` }]);
  assert.ok(F.live - base < 60, `vivos após reavaliações: ${F.live - base}`);
  nb.update(['a', 'b', 'c', 'd'].map((id) => ({ id, src: null })));
  assert.equal(F.live, base);
});

test('implicitplot: topologia e pontos sobre a curva', () => {
  const nb = new Notebook();
  const G = '(x, y) = gens(QQ[x, y]); ';
  const trace = (src) => {
    const d = byIdDisplay(nb.update([{ id: 'a', src: G + `implicitplot(${src})` }])).a;
    assert.equal(d.t, 'graphics');
    return d.items;
  };
  const resid = (items, f) => Math.max(0, ...items.flatMap((it) => it.pts.map(([x, y]) => Math.abs(f(x, y)))));
  let it = trace('x^2 + y^2 - 1');
  assert.deepEqual(it.map((l) => l.closed), [true]);
  assert.ok(resid(it, (x, y) => x * x + y * y - 1) < 1e-12);
  // Multiplicidade não some com a curva; fatores distintos viram linhas separadas.
  assert.equal(trace('(x^2 + y^2 - 1)^2').length, 1);
  it = trace('x^2 - y^2');
  assert.deepEqual(it.map((l) => l.closed), [false, false]);
  // Oval pequeno (raio 0,01) é encontrado; sem pontos reais, nada.
  it = trace('((x - 2)^2 + y^2 - 1/10000)*(x^2 + y^2 - 4)');
  assert.equal(it.length, 2);
  assert.equal(trace('x^2 + y^2 + 1').length, 0);
  it = trace('(x^2 + y^2)^2 - 2*(x^2 - y^2)');
  assert.ok(resid(it, (x, y) => (x * x + y * y) ** 2 - 2 * (x * x - y * y)) < 1e-8);
  const d = byIdDisplay(nb.update([{ id: 'a', src: 'x = gen(QQ[x]); implicitplot(x^2 - 2, xlim = [-2, 2])' }])).a;
  assert.equal(d.items.length, 2); // retas verticais x = ±√2
  assert.deepEqual(d.opts.ylim, [-2, 2]);
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
  assert.equal(r.display.t, 'graphics');
  assert.equal(r.display.items[0].pts.length, 11);
  assert.ok(Math.abs(r.display.items[0].pts[5][1] - Math.sin(1.5)) < 1e-12);
});

test('xlim/ylim fixam a janela dos gráficos', () => {
  const nb = new Notebook();
  const res = nb.update([
    { id: 'a', src: 'plot(sin, 0, 10, xlim = [2, 4], ylim = [-1/2, 1/2])' },
    { id: 'b', src: 'listplot([1, 4, 9], ylim = [0, 5])' },
    { id: 'c', src: 'complexplot([i, 2 + i], xlim = [-1, 3], ylim = [-1, 1.5])' },
    { id: 'd', src: 'listplot([1, 2], xlim = [3, 1])' },
  ]);
  const [a, b, c, d] = res;
  assert.deepEqual([a.display.opts.xlim, a.display.opts.ylim], [[2, 4], [-0.5, 0.5]]);
  assert.equal(b.display.opts.xlim, null);
  assert.deepEqual(b.display.opts.ylim, [0, 5]);
  assert.deepEqual([c.display.opts.xlim, c.display.opts.ylim, c.display.opts.aspect], [[-1, 3], [-1, 1.5], 'equal']);
  assert.equal(d.status, 'error');
  assert.match(d.error.message, /xlim deve ser \[lo, hi\]/);
});

test('primitivas gráficas: pontos, atributos e combinação', () => {
  const nb = new Notebook();
  const res = nb.update([
    { id: 'a', src: 'circle(1 + i, 1/2, color = "red", dash = "dot", width = 2)' },
    { id: 'b', src: 'segment((0, 0), 2) + point(i, marker = "square")' },
    { id: 'c', src: '[polygon([0, 1, i], fill = true), text("z", 1, pos = "ne")]' },
    { id: 'd', src: 'draw(arc(0, 1, 0, pi), xlim = [-2, 2], axes = false, aspect = "auto")' },
    { id: 'e', src: 'plot(sin, 0, 1, points = 2, color = 3) + infline(0, 1)' },
    { id: 'f', src: '[circle(0, 1), 3]' },
  ]);
  const [a, b, c, d, e, f] = res.map((r) => r.display);
  assert.deepEqual(a.items, [{ g: 'circle', c: [1, 1], r: 0.5, attrs: { color: 'red', dash: '1.5 3', width: 2 } }]);
  assert.deepEqual(b.items.map((x) => [x.g, x.pts]), [['line', [[0, 0], [2, 0]]], ['points', [[0, 1]]]]);
  assert.equal(b.items[1].attrs.marker, 'square');
  assert.equal(c.t, 'graphics');
  assert.deepEqual(c.items.map((x) => x.g), ['line', 'text']);
  assert.equal(c.items[0].closed, true);
  assert.equal(c.items[1].pos, 'ne');
  assert.deepEqual(d.opts, { xlim: [-2, 2], axes: false, aspect: 'auto' });
  assert.equal(d.items[0].t1, Math.PI);
  assert.deepEqual(e.items.map((x) => [x.g, x.attrs.color]), [['line', 3], ['infline', undefined]]);
  assert.equal(e.opts.aspect, 'auto');
  assert.equal(f.t, 'list');
});

test('group herda atributos e style os impõe', () => {
  const nb = new Notebook();
  const [g, s] = nb.update([
    { id: 'g', src: 'g = group(circle(0, 1, color = 2), disk(1, 1), color = "red", width = 3)' },
    { id: 's', src: 'g |> style(color = "blue")' },
  ]).map((r) => r.display);
  assert.equal(g.items[0].g, 'group');
  assert.deepEqual(g.items[0].attrs, { color: 'red', width: 3 });
  assert.deepEqual(g.items[0].items.map((x) => x.attrs), [{ color: 2 }, { fill: true }]);
  assert.deepEqual(s.items[0].items.map((x) => x.attrs.color), ['blue', 'blue']);
});

test('curve amostra uma curva paramétrica e rgb/hsl produzem cores', () => {
  const nb = new Notebook();
  const [c, r, h] = nb.update([
    { id: 'c', src: 'curve(t -> exp(i*t), 0, pi, points = 2)' },
    { id: 'r', src: 'rgb(1, 1/2, 0)' },
    { id: 'h', src: 'disk(0, 1, color = hsl(1/3, 1, 1/2))' },
  ]).map((x) => x.display);
  const pts = c.items[0].pts;
  assert.equal(pts.length, 3);
  assert.ok(Math.abs(pts[1][0]) < 1e-12 && Math.abs(pts[1][1] - 1) < 1e-12);
  assert.equal(r.s, 'rgb(255, 128, 0)');
  assert.equal(h.items[0].attrs.color, 'hsl(120, 100%, 50%)');
});

test('erros das primitivas gráficas', () => {
  const nb = new Notebook();
  const cases = {
    'circle(0, -1)': /raio deve ser positivo/,
    'circle(0, 1, foo = 2)': /atributo gráfico desconhecido: foo/,
    'circle(0, 1, color = "blurple")': /color deve ser uma cor/,
    'point("a")': /ponto deve ser um número complexo/,
    'polygon([0, 1])': /polygon: esperava pelo menos 3 pontos/,
    'infline(1, 1)': /distintos/,
    'arc(0, 1, 1, 0)': /ângulo final/,
    'circle(0, 1) - circle(0, 1)': /operador - não se aplica a gráfico e gráfico/,
    'draw(3)': /draw deve ser um gráfico/,
    'draw(circle(0, 1), zoom = 2)': /opção desconhecida de draw: zoom/,
    'point(0, opacity = 2)': /opacity deve estar entre 0 e 1/,
  };
  const srcs = Object.keys(cases);
  const res = nb.update(srcs.map((src, k) => ({ id: `e${k}`, src })));
  res.forEach((r, k) => {
    assert.equal(r.status, 'error', srcs[k]);
    assert.match(r.error.message, cases[srcs[k]]);
  });
});

test('notebooks de exemplo avaliam sem erros', async () => {
  const { EXAMPLES, pick } = await import('../src/ui/examples.js');
  for (const ex of EXAMPLES) {
    for (const lang of ['pt', 'en']) {
      const nb = new Notebook();
      const res = nb.update(ex.cells.map((c, k) => ({ id: `x${k}`, src: pick(c, lang) })));
      for (const r of res) assert.equal(r.status, 'ok', `${pick(ex.title, lang)}: ${r.error?.message}`);
    }
  }
});

test('transformações afins mantêm círculos e arcos exatos', () => {
  const nb = new Notebook();
  const [t, r, s, f, e, m] = nb.update([
    { id: 't', src: 'translate(circle(0, 1) + point((1, 1)), 2 + i)' },
    { id: 'r', src: 'rotate(arc(1, 1, 0, pi/2), pi/2, 1) |> scale(2)' },
    { id: 's', src: 'scale(circle(0, 1), (2, 1))' },
    { id: 'f', src: 'reflect(arc(0, 1, 0, pi/2), 0, 1)' },
    { id: 'e', src: 'scale(group(segment(0, 1), color = 2), 3, 1)' },
    { id: 'm', src: 'transform(text("a", 1), [0, -1; 1, 0])' },
  ]).map((x) => x.display);
  const close = (a, b) => a.every((x, k) => Math.abs(x - b[k]) < 1e-12);
  assert.deepEqual(t.items[0].c, [2, 1]);
  assert.deepEqual(t.items[1].pts, [[3, 2]]);
  const ar = r.items[0];
  assert.ok(close([...ar.c, ar.r, ar.t0, ar.t1], [2, 0, 2, Math.PI / 2, Math.PI]));
  assert.equal(s.items[0].g, 'line');
  assert.equal(s.items[0].closed, true);
  assert.ok(s.items[0].pts.some((p) => Math.abs(p[0] - 2) < 1e-12));
  const fr = f.items[0];
  assert.ok(close([fr.t0, fr.t1], [-Math.PI / 2, 0]));
  assert.equal(e.items[0].g, 'group');
  assert.deepEqual(e.items[0].items[0].pts, [[-2, 0], [1, 0]]);
  assert.ok(close(m.items[0].p, [0, 1]));
});

test('transform com função amostra e mapeia os pontos', () => {
  const nb = new Notebook();
  const [sq, ci, ar, bad] = nb.update([
    { id: 'sq', src: 'transform(segment(0, 1 + i), z -> z^2, steps = 4)' },
    { id: 'ci', src: 'transform(circle(0, 1), z -> 1/z)' },
    { id: 'ar', src: 'transform(arrow(1, 2), exp)' },
    { id: 'bad', src: 'transform(infline(0, 1), exp)' },
  ]);
  const pts = sq.display.items[0].pts;
  assert.equal(pts.length, 5);
  assert.ok(Math.abs(pts[2][0]) < 1e-12 && Math.abs(pts[2][1] - 0.5) < 1e-12);
  assert.ok(Math.abs(pts[4][1] - 2) < 1e-12);
  const c = ci.display.items[0];
  assert.equal(c.closed, true);
  assert.ok(c.pts.every((p) => Math.abs(Math.hypot(...p) - 1) < 1e-9));
  assert.equal(ar.display.items[0].arrow, true);
  assert.equal(bad.status, 'error');
  assert.match(bad.error.message, /retas infinitas/);
});
