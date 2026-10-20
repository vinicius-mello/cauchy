// Erro da linguagem, com posição opcional no código-fonte da célula.
import { CauchyError } from '../lang/lexer.js';

export { CauchyError };

export function fail(msg) {
  throw new CauchyError(msg);
}
