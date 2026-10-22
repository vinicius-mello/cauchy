// Erro da linguagem, com posição opcional no código-fonte da célula.
import { CauchyError } from '../lang/lexer.js';

export { CauchyError };

export function fail(msg) {
  throw new CauchyError(msg);
}

// Lançado no modo analítico da integração quando uma função não é (ou não se
// prova) holomorfa no argumento; o integrando vira indeterminado.
export class NonAnalytic extends Error {}
