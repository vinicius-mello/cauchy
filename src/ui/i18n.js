// Internacionalização da interface (português / inglês).
// Mensagens de erro do interpretador são escritas em português e traduzidas
// aqui por padrões, para manter o núcleo da linguagem simples.

export const LANGS = { pt: 'Português', en: 'English' };

const STRINGS = {
  pt: {
    untitled: 'Sem título',
    'run-all': 'Reavaliar', 'run-all.t': 'Reavaliar todas as células',
    add: '+ Célula', 'add.t': 'Nova célula no fim',
    examples: 'Exemplos…',
    new: 'Novo', 'new.t': 'Notebook vazio',
    import: 'Abrir', 'import.t': 'Abrir arquivo .cauchy.json',
    export: 'Salvar', 'export.t': 'Salvar como arquivo',
    share: 'Link', 'share.t': 'Copiar link com o notebook',
    help: 'Referência', 'help.t': 'Referência de funções',
    'title.a': 'título do notebook',
    'lang.a': 'idioma da interface',
    loading: 'carregando FLINT…', ready: 'pronto', computing: 'calculando…',
    stop: 'Interromper', autorun: 'avaliar ao digitar',
    objects: (n) => `${n} objetos FLINT`,
    'worker-error': (m) => `erro no worker: ${m}`,
    'fatal-restart': 'erro interno — reiniciando',
    'cell.run': 'Avaliar (Shift+Enter)', 'cell.up': 'Mover para cima', 'cell.down': 'Mover para baixo',
    'cell.add': 'Nova célula abaixo (Alt+Enter)', 'cell.del': 'Excluir célula', 'cell.code': 'código da célula',
    error: 'erro', digits: (n) => `${n} dígitos`, matrix: (r, c) => `matriz ${r}×${c}`,
    'link-copied': 'Link copiado para a área de transferência', 'link-in-url': 'Link no endereço da página',
    'bad-file': (m) => `Arquivo inválido: ${m}`, 'bad-link': 'Link de notebook inválido',
    'ref.search': 'Buscar…', 'ref.functions': 'Funções', 'ref.flint': 'FLINT', 'ref.syntax': 'Sintaxe',
    'ref.examples': 'Exemplos', 'ref.insert': 'Inserir', 'ref.newcell': 'Nova célula com este exemplo',
    'ref.uses': 'Usa na FLINT', 'ref.back': '← voltar', 'ref.all': 'Todas',
    'ref.flint-intro': 'Funções da FLINT expostas pela ponte wasm. Chame qualquer uma com flint("nome", args…); a precisão (prec) e o contexto do anel são preenchidos automaticamente. Clique no nome C para abrir a documentação oficial.',
    'ref.flint-call': 'chamada', 'ref.flint-c': 'função C', 'ref.count': (n) => `${n} funções`,
    'ref.returns': 'devolve',
  },
  en: {
    untitled: 'Untitled',
    'run-all': 'Re-run', 'run-all.t': 'Re-evaluate all cells',
    add: '+ Cell', 'add.t': 'New cell at the end',
    examples: 'Examples…',
    new: 'New', 'new.t': 'Empty notebook',
    import: 'Open', 'import.t': 'Open a .cauchy.json file',
    export: 'Save', 'export.t': 'Save as file',
    share: 'Link', 'share.t': 'Copy a link containing the notebook',
    help: 'Reference', 'help.t': 'Function reference',
    'title.a': 'notebook title',
    'lang.a': 'interface language',
    loading: 'loading FLINT…', ready: 'ready', computing: 'computing…',
    stop: 'Interrupt', autorun: 'evaluate while typing',
    objects: (n) => `${n} FLINT objects`,
    'worker-error': (m) => `worker error: ${m}`,
    'fatal-restart': 'internal error — restarting',
    'cell.run': 'Evaluate (Shift+Enter)', 'cell.up': 'Move up', 'cell.down': 'Move down',
    'cell.add': 'New cell below (Alt+Enter)', 'cell.del': 'Delete cell', 'cell.code': 'cell code',
    error: 'error', digits: (n) => `${n} digits`, matrix: (r, c) => `${r}×${c} matrix`,
    'link-copied': 'Link copied to the clipboard', 'link-in-url': 'Link is in the address bar',
    'bad-file': (m) => `Invalid file: ${m}`, 'bad-link': 'Invalid notebook link',
    'ref.search': 'Search…', 'ref.functions': 'Functions', 'ref.flint': 'FLINT', 'ref.syntax': 'Syntax',
    'ref.examples': 'Examples', 'ref.insert': 'Insert', 'ref.newcell': 'New cell with this example',
    'ref.uses': 'FLINT functions used', 'ref.back': '← back', 'ref.all': 'All',
    'ref.flint-intro': 'FLINT functions exposed by the wasm bridge. Call any of them with flint("name", args…); precision (prec) and the ring context are filled in automatically. Click the C name to open the official documentation.',
    'ref.flint-call': 'call', 'ref.flint-c': 'C function', 'ref.count': (n) => `${n} functions`,
    'ref.returns': 'returns',
  },
};

export const SYNTAX_NOTES = {
  pt: `<p>Inteiros e racionais são exatos. Decimais e funções transcendentes produzem
<em>bolas</em>: aproximações com raio de erro garantido (Arb). Comparações que a
precisão não decide geram erro — aumente <code>prec</code>.</p>
<p>Listas e matrizes são indexadas a partir de 1; <code>xs[-1]</code> é o último elemento.
Um polinômio é também uma função: <code>p(3)</code>, <code>p(x + 1)</code>.</p>
<p><kbd>Shift</kbd>+<kbd>Enter</kbd> avalia · <kbd>Alt</kbd>+<kbd>Enter</kbd> nova célula ·
<kbd>Ctrl</kbd>+<kbd>.</kbd> interrompe</p>`,
  en: `<p>Integers and rationals are exact. Decimals and transcendental functions produce
<em>balls</em>: approximations with a guaranteed error radius (Arb). Comparisons that the
current precision cannot decide raise an error — increase <code>prec</code>.</p>
<p>Lists and matrices are 1-indexed; <code>xs[-1]</code> is the last element.
A polynomial is also a function: <code>p(3)</code>, <code>p(x + 1)</code>.</p>
<p><kbd>Shift</kbd>+<kbd>Enter</kbd> evaluates · <kbd>Alt</kbd>+<kbd>Enter</kbd> new cell ·
<kbd>Ctrl</kbd>+<kbd>.</kbd> interrupts</p>`,
};

export const SYNTAX_CODE = {
  pt: `n = 2^64 + 1          # definição
f(x) = x^2 + 1        # função
f(0) = 1; f(n) = n*f(n-1)   # cláusulas
g = t -> sin(t)/t     # lambda
[k^2 | k <- 1..10, isodd(k)]
xs |> filter(isprime) |> sum
xs.map(f).sum         # sintaxe de método
let a = 2, b = 3 in a*b
if x > 0 then x else -x
match xs { [h, ...t] => h; _ => 0 }
with digits = 50: pi  # precisão local
R = QQ[x]; x = gen(R) # polinômios
A = [1, 2; 3, 4]      # matriz
F = GF(5^3); a = gen(F)
k = slider(1, 10)     # entrada reativa
flint("arb_gamma", 1/3)   # FLINT direto`,
  en: `n = 2^64 + 1          # definition
f(x) = x^2 + 1        # function
f(0) = 1; f(n) = n*f(n-1)   # clauses
g = t -> sin(t)/t     # lambda
[k^2 | k <- 1..10, isodd(k)]
xs |> filter(isprime) |> sum
xs.map(f).sum         # method syntax
let a = 2, b = 3 in a*b
if x > 0 then x else -x
match xs { [h, ...t] => h; _ => 0 }
with digits = 50: pi  # local precision
R = QQ[x]; x = gen(R) # polynomials
A = [1, 2; 3, 4]      # matrix
F = GF(5^3); a = gen(F)
k = slider(1, 10)     # reactive input
flint("arb_gamma", 1/3)   # raw FLINT call`,
};

let lang = 'pt';

export function detectLang() {
  try {
    const saved = localStorage.getItem('cauchy.lang');
    if (saved && LANGS[saved]) return saved;
  } catch {
    // sem armazenamento
  }
  return (navigator.language || 'pt').toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

export function setLang(l) {
  lang = LANGS[l] ? l : 'pt';
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
  try {
    localStorage.setItem('cauchy.lang', lang);
  } catch {
    // ignora
  }
}

export function getLang() {
  return lang;
}

export function t(key, ...args) {
  const v = STRINGS[lang][key] ?? STRINGS.pt[key] ?? key;
  return typeof v === 'function' ? v(...args) : v;
}

// Aplica textos a elementos com data-i18n (conteúdo), data-i18n-title e
// data-i18n-aria.
export function applyStatic(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
}

// ------------------------------------------------------- mensagens de erro

const WORDS = {
  lista: 'list', tupla: 'tuple', 'função': 'function', anel: 'ring', booleano: 'boolean',
  argumento: 'argument', 'índice': 'index', valor: 'value', 'condição': 'condition',
  'operando de and': 'operand of and', 'operando de or': 'operand of or', 'operando de not': 'operand of not',
  filtro: 'filter', guarda: 'guard', predicado: 'predicate', 'fim da entrada': 'end of input',
  'quebra de linha': 'line break', fim: 'end',
};
const w = (s) => WORDS[s] ?? s;

// [padrão, tradução] — do mais específico para o mais genérico.
const RULES = [
  [/^nome não definido: (.+)$/, 'undefined name: $1'],
  [/^divisão por zero$/, 'division by zero'],
  [/^(.+) espera (\d+) argumentos?, recebeu (\d+)$/, (_, f, n, m) => `${w(f)} expects ${n} argument${n === '1' ? '' : 's'}, got ${m}`],
  [/^(.+) espera mais argumentos: (.+)$/, '$1 expects more arguments: $2'],
  [/^(.+)\(\) espera um argumento$/, '$1() expects one argument'],
  [/^(.+) não é ordenado$/, '$1 is not ordered'],
  [/^(.+) não é uma função$/, (_, x) => `${w(x)} is not a function`],
  [/^(.+) deve ser não negativo$/, (_, x) => `${w(x)} must be non-negative`],
  [/^(.+) deve ser booleana \(true\/false\)$/, (_, x) => `${w(x)} must be a boolean (true/false)`],
  [/^(.+) deve ser uma matriz$/, (_, x) => `${w(x)} must be a matrix`],
  [/^(.+) deve ser um inteiro \(recebeu (.+)\)$/, (_, x, y) => `${w(x)} must be an integer (got ${w(y)})`],
  [/^(.+) deve ser um inteiro$/, (_, x) => `${w(x)} must be an integer`],
  [/^(.+) deve ser um número, polinômio ou matriz \(recebeu (.+)\)$/, (_, x, y) => `${w(x)} must be a number, polynomial or matrix (got ${w(y)})`],
  [/^(.+) deve ser um polinômio$/, (_, x) => `${w(x)} must be a polynomial`],
  [/^(.+) grande demais$/, (_, x) => `${w(x)} too large`],
  [/^a matriz deve ser quadrada$/, 'the matrix must be square'],
  [/^anel grande demais$/, 'ring too large'],
  [/^corpo grande demais$/, 'field too large'],
  [/^argumento posicional após argumento nomeado$/, 'positional argument after keyword argument'],
  [/^argumentos nomeados não são permitidos em definições$/, 'keyword arguments are not allowed in definitions'],
  [/^avaliação de polinômio espera 1 argumento$/, 'polynomial evaluation expects 1 argument'],
  [/^base entre 2 e 62$/, 'base must be between 2 and 62'],
  [/^caractere inesperado '(.*)'$/, "unexpected character '$1'"],
  [/^cláusulas de (.+) com números de parâmetros diferentes$/, 'clauses of $1 have different numbers of parameters'],
  [/^comparação indecidível com a precisão atual \(as bolas se sobrepõem\); aumente prec$/, 'comparison undecidable at the current precision (the balls overlap); increase prec'],
  [/^(\w+) requer polinômios? sobre ZZ ou QQ$/, '$1 requires a polynomial over ZZ or QQ'],
  [/^0 não tem ordem multiplicativa$/, '0 has no multiplicative order'],
  [/^a bola não determina um inteiro único; aumente a precisão$/, 'the ball does not determine a unique integer; increase the precision'],
  [/^a característica de GF\(p\^k\) deve ser prima$/, 'the characteristic of GF(p^k) must be prime'],
  [/^o grau de GF\(p\^k\) deve ser positivo$/, 'the degree of GF(p^k) must be positive'],
  [/^o módulo deve ser maior que 1$/, 'the modulus must be greater than 1'],
  [/^dimensões incompatíveis: (.+) · (.+)$/, 'incompatible dimensions: $1 · $2'],
  [/^dimensões incompatíveis: (.+) e (.+)$/, 'incompatible dimensions: $1 and $2'],
  [/^dimensões incompatíveis$/, 'incompatible dimensions'],
  [/^divisão de polinômios indecidível \(coeficiente líder contém zero\)$/, 'polynomial division undecidable (leading coefficient contains zero)'],
  [/^divisão de polinômios reais\/complexos: use divrem\(p, q\)$/, 'division of real/complex polynomials: use divrem(p, q)'],
  [/^divisão não exata de polinômios; use divrem, quo ou rem$/, 'inexact polynomial division; use divrem, quo or rem'],
  [/^divisão impossível em Z\/nZ$/, 'impossible division in Z/nZ'],
  [/^divisão não exata$/, 'inexact division'],
  [/^elemento não inversível em Z\/nZ$/, 'element not invertible in Z/nZ'],
  [/^elemento não inversível$/, 'element not invertible'],
  [/^(.+) em Z\/nZ\[x\] requerem? n primo$/, (_, x) => `${{ 'fatoração': 'factorization', 'raízes': 'roots', divrem: 'divrem' }[x] ?? x} in Z/nZ[x] requires n prime`],
  [/^(.+) em Z\/nZ requer n primo$/, (_, x) => `${{ 'inversão': 'inversion', sqrt: 'sqrt' }[x] ?? x} in Z/nZ requires n prime`],
  [/^inteiro inválido$/, 'invalid integer'],
  [/^número real inválido$/, 'invalid real number'],
  [/^matriz singular$/, 'singular matrix'],
  [/^não é possível fatorar 0$/, 'cannot factor 0'],
  [/^não é possível fatorar o polinômio zero$/, 'cannot factor the zero polynomial'],
  [/^não é um quadrado$/, 'not a square'],
  [/^não é um resíduo quadrático$/, 'not a quadratic residue'],
  [/^não foi possível inverter \(singular ou precisão insuficiente\)$/, 'could not invert (singular or insufficient precision)'],
  [/^sistema singular ou precisão insuficiente$/, 'singular system or insufficient precision'],
  [/^o polinômio zero tem todas as raízes$/, 'the zero polynomial has every element as a root'],
  [/^random\(n\) requer n > 0$/, 'random(n) requires n > 0'],
  [/^zetazero\(n\) requer n >= 1$/, 'zetazero(n) requires n >= 1'],
  [/^definição fora de lugar$/, 'definition out of place'],
  [/^(.+) espera (.+)$/, (_, f, x) => `${f} expects ${x
    .replace('um anel de polinômios ou de matrizes', 'a polynomial or matrix ring')
    .replace('um anel de polinômios ou corpo finito', 'a polynomial ring or finite field')
    .replace('elemento de Z/nZ, GF(q) ou polinômio/matriz sobre Z/nZ', 'an element of Z/nZ, GF(q) or a polynomial/matrix over Z/nZ')
    .replace('elemento de GF(q)', 'an element of GF(q)')
    .replace('um corpo finito, Z/nZ ou elemento', 'a finite field, Z/nZ or element')
    .replace('Z/nZ ou GF(q)', 'Z/nZ or GF(q)')
    .replace('um anel', 'a ring')
    .replace('o nome da função como string', 'the function name as a string')}`],
  [/^entradas de matriz devem ser escalares ou polinômios$/, 'matrix entries must be scalars or polynomials'],
  [/^esperado '(.+)', encontrado (.+)$/, (_, a, b) => `expected '${w(a)}', found ${w(b)}`],
  [/^esperado um nome$/, 'expected a name'],
  [/^esperava uma função$/, 'expected a function'],
  [/^expoente grande demais$/, 'exponent too large'],
  [/^expressão incompleta$/, 'incomplete expression'],
  [/^fixedpoint não convergiu$/, 'fixedpoint did not converge'],
  [/^"\.\.\." fora de lista ou chamada$/, '"..." outside a list or call'],
  [/^"\.\.\." só pode aparecer no fim de um padrão de lista$/, '"..." may only appear at the end of a list pattern'],
  [/^função não definida para (.+)$/, 'function not defined for $1'],
  [/^GF\(q\) requer q potência de primo$/, 'GF(q) requires q to be a prime power'],
  [/^(\w+) requer matriz inteira$/, '$1 requires an integer matrix'],
  [/^índice (-?\d+) fora do intervalo 1\.\.(\d+)$/, 'index $1 out of range 1..$2'],
  [/^índice negativo$/, 'negative index'],
  [/^índice único esperado$/, 'a single index was expected'],
  [/^intervalo do gráfico inválido$/, 'invalid plot interval'],
  [/^intervalo grande demais$/, 'range too large'],
  [/^laço longo demais$/, 'loop too long'],
  [/^limites do intervalo devem ser números$/, 'range bounds must be numbers'],
  [/^linhas da matriz com tamanhos diferentes$/, 'matrix rows have different lengths'],
  [/^listas de tamanhos diferentes$/, 'lists of different lengths'],
  [/^vetores de tamanhos diferentes$/, 'vectors of different lengths'],
  [/^lista vazia$/, 'empty list'],
  [/^(min|max) de lista vazia$/, '$1 of an empty list'],
  [/^reduce de lista vazia sem valor inicial$/, 'reduce of an empty list without an initial value'],
  [/^matrizes sobre (.+) não são suportadas$/, 'matrices over $1 are not supported'],
  [/^polinômios sobre (.+) não são suportados$/, 'polynomials over $1 are not supported'],
  [/^não é possível converter (.+) em (.+)$/, (_, a, b) => `cannot convert ${w(a)} to ${b}`],
  [/^não há anel comum para (.+) e (.+)$/, 'no common ring for $1 and $2'],
  [/^não há primo menor$/, 'there is no smaller prime'],
  [/^negação de valor não numérico$/, 'negation of a non-numeric value'],
  [/^nenhuma cláusula de (.+) corresponde aos argumentos$/, (_, f) => `no clause of ${w(f)} matches the arguments`],
  [/^nenhum caso do match corresponde ao valor$/, 'no match case matches the value'],
  [/^nó desconhecido: (.+)$/, 'unknown node: $1'],
  [/^número complexo com parte imaginária não nula$/, 'complex number with nonzero imaginary part'],
  [/^opção desconhecida em with: (.+)$/, 'unknown option in with: $1'],
  [/^operador (.+) não se aplica a strings$/, 'operator $1 does not apply to strings'],
  [/^operador (.+) não se aplica a (.+) e (.+)$/, (_, o, a, b) => `operator ${o} does not apply to ${w(a)} and ${w(b)}`],
  [/^operador desconhecido (.+)$/, 'unknown operator $1'],
  [/^o valor não corresponde ao padrão$/, 'the value does not match the pattern'],
  [/^padrão inválido$/, 'invalid pattern'],
  [/^passo zero$/, 'zero step'],
  [/^polinômio avaliado em valor não numérico$/, 'polynomial evaluated at a non-numeric value'],
  [/^polinômios em variáveis diferentes: (.+) e (.+)$/, 'polynomials in different variables: $1 and $2'],
  [/^variáveis diferentes: (.+) e (.+)$/, 'different variables: $1 and $2'],
  [/^potência (.+) não suportada$/, 'power $1 not supported'],
  [/^precisão fora do intervalo$/, 'precision out of range'],
  [/^racional não inteiro$/, 'non-integer rational'],
  [/^sinal não definido em (.+)$/, 'sign not defined in $1'],
  [/^string não terminada$/, 'unterminated string'],
  [/^token inesperado '(.*)'$/, "unexpected token '$1'"],
  [/^use R\[x\] com um nome de variável$/, 'use R[x] with a variable name'],
  [/^valor não indexável$/, 'value is not indexable'],
  [/^valor não iterável$/, 'value is not iterable'],
  [/^valuation\(0, p\) é infinito$/, 'valuation(0, p) is infinite'],
  [/^Zmod\(n\) requer n > 1$/, 'Zmod(n) requires n > 1'],
  [/^(xlim|ylim) deve ser \[lo, hi\] com lo < hi$/, '$1 must be [lo, hi] with lo < hi'],
  [/^função FLINT desconhecida: (.+)$/, 'unknown FLINT function: $1'],
  [/^tipo FLINT desconhecido: (.+)$/, 'unknown FLINT type: $1'],
  [/^(.+) requer um anel Zmod\(n\)\/GF\(q\) como argumento$/, '$1 requires a Zmod(n)/GF(q) ring as an argument'],
  [/^(.+) não (?:suportad[oa]|definid[oa]) em (.+)$/, (_, f, r) => `${f.replace(/^(potência|divisão|avaliação|inversa|inverso|integral)$/, (m) => ({ 'potência': 'power', 'divisão': 'division', 'avaliação': 'evaluation', inversa: 'inverse', inverso: 'inverse', integral: 'integral' })[m])} not supported in ${r}`],
  [/^avaliação interrompida$/, 'evaluation interrupted'],
  [/^depende de célula interrompida$/, 'depends on an interrupted cell'],
  [/^depende de célula com erro \((.*)\)$/, 'depends on a cell with an error ($1)'],
  [/^'(.+)' é definido em mais de uma célula$/, "'$1' is defined in more than one cell"],
  [/^dependência circular: (.+)$/, 'circular dependency: $1'],
  [/^recursão profunda demais$/, 'recursion too deep'],
  [/^erro interno: (.+)$/, (_, m) => `internal error: ${translateError(m)}`],
  [/^erro interno no wasm: (.+)$/, 'internal wasm error: $1'],
  [/^FLINT abortou a operação$/, 'FLINT aborted the operation'],
  [/^asserção falhou$/, 'assertion failed'],
  [/^intervalo grande demais$/, 'range too large'],
];

export function translateError(msg) {
  if (lang === 'pt' || !msg) return msg;
  for (const [re, rep] of RULES) {
    if (re.test(msg)) return msg.replace(re, rep);
  }
  return msg;
}

export { RULES };
