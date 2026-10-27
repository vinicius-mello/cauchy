import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { init, Notebook, toText } from './harness.mjs';

let F;
before(async () => { F = await init(); });

const show = (r) => (r.status === 'error' ? `ERRO: ${r.error.message}` : r.display ? toText(r.display) : '');
const byId = (res) => Object.fromEntries(res.map((r) => [r.id, show(r)]));
const byIdDisplay = (res) => Object.fromEntries(res.map((r) => [r.id, r.display]));
// Exibição da célula, ou o primeiro controle do painel.
const byIdShown = (res) => Object.fromEntries(res.map((r) => [r.id, r.display ?? r.panel?.[0]?.d]));

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

test('memória: integrate libera os temporários de cada avaliação', () => {
  const nb = new Notebook();
  const base = F.live;
  nb.update([{ id: 'a', src: 'with digits = 30: integrate(t -> sin(t + exp(t))*abs(t - 1), 0, 4) + integrate(t -> integrate(s -> s*t, 0, 1), 0, 1)' }]);
  assert.ok(F.live - base < 20, `vivos: ${F.live - base}`);
  nb.update([{ id: 'a', src: null }]);
  assert.equal(F.live, base);
});

test('pontos de controle: arraste, vértices arrastáveis e restrições', () => {
  const nb = new Notebook();
  let d = byIdShown(nb.update([
    { id: 'a', src: 'p = handle(1 + i)' },
    { id: 'b', src: 'q = handle(-1, snap = 1/4)' },
    { id: 'g', src: 'segment(p, q) + point((p + q)/2) + circle(p, 1) + translate(point(p), 1)' },
  ]));
  const from = d.a.spec.from;
  assert.equal(d.a.value.text, '1 + i');
  // segment: os dois vértices; ponto médio derivado: nada; círculo: centro; transformado: nada.
  assert.deepEqual(d.g.items.map((it) => (it.drag ?? []).map((h) => `${h.id}:${h.k}`)), [['a:0', 'b:1'], [], ['a:c'], []]);
  d = byIdShown(nb.setWidget('a', 'p', { from, at: ['0.5', '2.25'] }));
  assert.equal(d.a.value.text, '0.5 + 2.25·i');
  assert.deepEqual(d.g.items[0].pts[0], [0.5, 2.25]);
  // snap: valor exato na grade.
  d = byIdShown(nb.setWidget('b', 'q', { from: d.b?.spec.from ?? '-1', at: ['0.537', '-0.444'] }));
  assert.equal(d.b.value.text, '0.5 - 0.5·i');
  // Tupla com snap racional: coordenadas racionais exatas.
  d = byIdShown(nb.update([{ id: 'r', src: 'r = handle((0, 0), snap = 1/3)' }, { id: 's', src: 'r' }]));
  d = byIdShown(nb.setWidget('r', 'r', { from: d.r.spec.from, at: ['0.7', '-0.3'] }));
  assert.equal(d.r.value.text, '(2/3, -1/3)');
  assert.equal(toText(d.s), '(2/3, -1/3)');
  // Editar o ponto inicial no código reposiciona.
  d = byIdShown(nb.update([{ id: 'a', src: 'p = handle(2)' }]));
  assert.equal(d.a.value.text, '2');
  // on = f projeta a posição.
  d = byIdShown(nb.update([{ id: 'u', src: 'u = handle(1, on = z -> z/abs(z))' }]));
  d = byIdShown(nb.setWidget('u', 'u', { from: d.u.spec.from, at: ['0', '3'] }));
  assert.equal(d.u.value.text, 'i');
  // Listas: elementos arrastáveis; a lista inteira permite acrescentar e remover.
  d = byIdShown(nb.update([{ id: 'l', src: 'vs = handles([0, 1, i], add = true, min = 2)' }, { id: 'h', src: 'polygon(vs)' }]));
  const it = d.h.items[0];
  assert.equal(it.drag.length, 3);
  assert.deepEqual([it.dragList.add, it.dragList.min, it.dragList.entries], [true, 2, [0, 1, 2]]);
  d = byIdShown(nb.setWidget('l', 'vs', { from: d.l.spec.from, pts: [0, ['2', '2'], 2, ['-1', '0.5']] }));
  assert.equal(d.l.value.text, '[0, 2 + 2·i, i, -1 + 0.5·i]');
  assert.equal(d.h.items[0].pts.length, 4);
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
  assert.equal(res[0].display, null);
  assert.deepEqual(res[0].panel.map((p) => [p.label, p.d.kind]), [['k', 'slider']]);
  res = nb.setWidget('k', 'k', 7);
  assert.equal(byId(res).sq, '49');
});

test('widgets: vários numa célula, com estado pelo nome', () => {
  const nb = new Notebook();
  const panel = (r) => r.panel.map((p) => `${p.label}:${p.d.kind}`);
  let [r] = nb.update([{ id: 'w', src: 'n = slider(1, 10)\nok = checkbox()' }]);
  assert.deepEqual(panel(r), ['n:slider', 'ok:checkbox']);
  assert.equal(r.display, null);
  nb.setWidget('w', 'n', 7);
  // Inserir um controle antes não desloca o estado dos outros.
  [r] = nb.update([{ id: 'w', src: 'm = slider(1, 5)\nn = slider(1, 10)\nok = checkbox()\nn + m' }]);
  assert.deepEqual(panel(r), ['m:slider', 'n:slider', 'ok:checkbox']);
  assert.equal(show(r), '8');
  assert.deepEqual(Object.keys(r.widgets), ['m', 'n', 'ok']);
  // Desestruturação: as variáveis recebem os valores.
  const res = nb.update([{ id: 't', src: '(a, b) = (slider(1, 10, value = 3), select(["x", "y"]))' }, { id: 'u', src: '(a^2, b)' }]);
  assert.deepEqual(panel(res[0]), ['a:slider', 'b:select']);
  assert.equal(byId(res).u, '(9, x)');
  assert.equal(byId(nb.setWidget('t', 'b', 1)).u, '(9, y)');
  // Cadernos antigos: estado indexado pela ordem de criação.
  [r] = nb.update([{ id: 'v', src: 'p = slider(1, 10)\nq = slider(1, 10)\np*q', widgets: [{ kind: 'slider', value: 2 }, { kind: 'slider', value: 5 }] }]);
  assert.equal(show(r), '10');
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

test('gráficos 3D: primitivas, malhas e opções', () => {
  const nb = new Notebook();
  const d = byIdDisplay(nb.update([
    { id: 'p', src: 'point((1, 2, 3)) + segment((0, 0, 0), (1, 1, 1)) + sphere((0, 0, 0), 2) + plane((0, 0, 1), (0, 0, 1))' },
    { id: 's', src: 'surface((u, v) -> (u, v, u*v), [0, 1], [0, 2], points = [4, 8])' },
    { id: 'f', src: 'draw(plot3d((x, y) -> 1/x, [-1, 1], [-1, 1], points = 2), zlim = [-5, 5], box = false)' },
    { id: 'c', src: 'curve(t -> (cos(t), sin(t), t), 0, 1, points = 10)' },
    { id: 'l', src: 'surface((u, v) -> (1/u, v, 0), [0, 1], [0, 1], xlim = [0, 4], ylim = [0, 1], points = 2)' },
  ]));
  assert.equal(d.p.t, 'graphics3d');
  assert.deepEqual(d.p.items.map((it) => it.g), ['points', 'line', 'sphere', 'plane']);
  assert.ok(d.p.items.every((it) => it.d3));
  assert.deepEqual(d.p.items[0].pts, [[1, 2, 3]]);
  // Grade (nu + 1)×(nv + 1): vértice (i, j) em (i·(nv + 1) + j)·3.
  const m = d.s.items[0];
  assert.deepEqual([m.g, m.nu, m.nv, m.pos.length], ['mesh', 4, 8, 5 * 9 * 3]);
  assert.deepEqual([...m.pos.slice((4 * 9 + 8) * 3, (4 * 9 + 8) * 3 + 3)], [1, 2, 2]);
  // plot3d: 1/x não está definida em x = 0 (NaN), e draw guarda zlim e box.
  const f = d.f.items[0];
  assert.ok(Number.isNaN(f.pos[(1 * 3 + 0) * 3 + 2]) && f.pos[2] === -1);
  assert.deepEqual([d.f.opts.zlim, d.f.opts.box, d.f.opts.aspect, f.attrs.colormap], [[-5, 5], false, 'auto', 'z']);
  assert.equal(d.c.items[0].pts.length, 11);
  assert.equal(d.c.items[0].pts[10].length, 3);
  // surface: xlim/ylim fixam a caixa; zlim ausente fica a cargo dos dados.
  assert.deepEqual([d.l.opts.xlim, d.l.opts.ylim, 'zlim' in d.l.opts], [[0, 4], [0, 1], false]);
});

test('gráficos 3D: erros', () => {
  const nb = new Notebook();
  const r = byId(nb.update([
    { id: 'a', src: 'point(1) + point((1, 2, 3))' },
    { id: 'b', src: 'draw(point(1), zlim = [0, 1])' },
    { id: 'c', src: 'surface((u, v) -> u, [0, 1], [0, 1])' },
    { id: 'd', src: 'plane((0, 0, 0), (0, 0, 0))' },
    { id: 'e', src: 'line([(0, 0), (1, 1, 1)])' },
    { id: 'f', src: 'rotate(sphere((0, 0, 0), 1), 1)' },
    { id: 'g', src: 'plot3d((x, y) -> x, [0, 1], [0, 1], exclude = "sim")' },
  ]));
  assert.deepEqual(r, {
    a: 'ERRO: não é possível juntar gráficos 2D e 3D',
    b: 'ERRO: zlim só vale para gráficos 3D',
    c: 'ERRO: surface: a função deve devolver uma tupla (x, y, z)',
    d: 'ERRO: normal não pode ser nulo',
    e: 'ERRO: line: pontos do plano e do espaço misturados',
    f: 'ERRO: rotate ainda não aceita gráficos 3D',
    g: 'ERRO: exclude deve ser true, false ou "arb"',
  });
});

test('gráficos 3D: exclude', () => {
  const nb = new Notebook();
  const d = byIdDisplay(nb.update([
    { id: 'a', src: 'plot3d((x, y) -> 1/x, [-1, 1], [-1, 1], points = 5)' },
    { id: 'b', src: 'plot3d((x, y) -> 1/x, [-1, 1], [-1, 1], points = 5, exclude = false)' },
    { id: 'c', src: 'plot3d((x, y) -> 1/x, [-1, 1], [-1, 1], points = 5, exclude = "arb")' },
    { id: 'd', src: 'surface((u, v) -> (u, v, if u > 1/2 then 1/(u - 0.7) else u), [0, 1], [0, 1], points = [5, 2], exclude = "arb")' },
  ]));
  // O padrão fica para o desenho; "arb" marca as células com possível polo.
  assert.deepEqual([d.a.items[0].exclude, d.a.items[0].cut, d.b.items[0].exclude], ['auto', undefined, false]);
  const cells = (it) => [...it.cut].join('');
  // Grade 5×5 em [−1, 1]: só a coluna do meio, x ∈ [−0.2, 0.2], contém x = 0.
  assert.equal(cells(d.c.items[0]), '00000' + '00000' + '11111' + '00000' + '00000');
  // u ∈ [0.6, 0.8] contém o polo; em [0.4, 0.6] o if é indecidível, e a união
  // dos dois ramos ainda é finita: a célula fica.
  assert.equal(cells(d.d.items[0]), '00' + '00' + '00' + '11' + '00');
});
