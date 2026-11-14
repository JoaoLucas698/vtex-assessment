import { Injectable } from '@nestjs/common';

/** Marcas combinantes (acentos) que sobram depois da decomposição NFD. */
const COMBINING_MARKS = /\p{M}/gu;
/** Aspas removidas da chave: `"` e `'` (o `''` usado como polegada some junto). */
const QUOTES = /["']/g;
/** Qualquer sequência de whitespace (espaço, tab, quebra de linha). */
const WHITESPACE_RUN = /\s+/g;
/** Separador entre marca e nome na chave. Impede que marca vazia colida com marca preenchida. */
const KEY_SEPARATOR = '|';

/**
 * Normalização usada para identificar o mesmo produto entre sellers
 * (`docs/context.md` §4, D-005).
 *
 * Esta é a **única** implementação TypeScript da regra. O backfill da migration
 * replica exatamente os mesmos passos em SQL, e um teste de consistência compara
 * as duas chaves em todos os produtos do banco (D-019). Por isso a regra não pode
 * ganhar passos novos sem mudar o SQL e recalcular as chaves no mesmo PR.
 *
 * Service puro: sem estado e sem dependências.
 */
@Injectable()
export class ProductNormalizerService {
  /**
   * Normaliza um texto, nesta ordem:
   * 1. remove acentos (decomposição NFD + remoção das marcas combinantes);
   * 2. converte para minúsculas;
   * 3. remove todas as aspas simples e duplas;
   * 4. troca qualquer sequência de whitespace por um espaço e faz trim.
   *
   * `null`, `undefined` e texto vazio viram `''`.
   *
   * O resultado serve só para comparação: o dado original enviado pelo seller
   * nunca é alterado (ex.: `Levi's` continua gravado com a aspa).
   */
  normalize(text: string | null | undefined): string {
    if (!text) return '';
    return text
      .normalize('NFD')
      .replace(COMBINING_MARKS, '')
      .toLowerCase()
      .replace(QUOTES, '')
      .replace(WHITESPACE_RUN, ' ')
      .trim();
  }

  /**
   * Monta o `normalizedKey` do produto: `<marca normalizada>|<nome normalizado>`.
   * Marca `null`, `undefined` ou vazia gera `|<nome normalizado>`.
   * A categoria não entra na chave (varia entre sellers para o mesmo produto).
   */
  buildKey(brand: string | null | undefined, name: string): string {
    return `${this.normalize(brand)}${KEY_SEPARATOR}${this.normalize(name)}`;
  }
}
