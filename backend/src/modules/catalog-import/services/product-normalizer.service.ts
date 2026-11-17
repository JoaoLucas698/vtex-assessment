import { Injectable } from '@nestjs/common';
import type {
  NormalizationRule,
  ProductKeyFields,
} from '@modules/catalog-import/schemas/catalog-import.types';

/** Marcas combinantes (acentos) que sobram depois da decomposição NFD. */
const COMBINING_MARKS = /\p{M}/gu;
/** Aspas removidas da chave: `"` e `'` (o `''` usado como polegada some junto). */
const QUOTES = /["']/g;
/** Qualquer sequência de whitespace (espaço, tab, quebra de linha). */
const WHITESPACE_RUN = /\s+/g;
/** Separador entre as partes da chave. Impede que parte vazia colida com parte preenchida. */
const KEY_SEPARATOR = '|';

/**
 * Normalização usada para identificar o mesmo produto entre sellers
 * (`docs/context.md` §4, D-005).
 *
 * Esta é a **única** implementação TypeScript da regra. O backfill da migration
 * replica exatamente os mesmos passos em SQL, e um teste de consistência compara
 * as duas chaves (regra `NAME_BRAND`) em todos os produtos do banco (D-019). Por isso
 * o `normalize` não pode ganhar passos novos sem mudar o SQL e recalcular as chaves
 * no mesmo PR.
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
   * Monta o `normalizedKey` do produto conforme a regra do tipo de normalização
   * (D-110, D-112). As partes entram sempre nesta ordem, só as incluídas pela regra,
   * cada uma normalizada e unidas por `|`:
   *
   * `<marca>|<categoria>|<nome>`
   *
   * - `NAME_BRAND` (marca e nome): `<marca>|<nome>`, exatamente o formato das chaves
   *   legadas e do backfill da migration. É este formato que o teste de consistência
   *   compara com o SQL (D-019);
   * - `NAME_CATEGORY`: `<categoria>|<nome>`;
   * - `NAME_BRAND_CATEGORY`: `<marca>|<categoria>|<nome>`.
   *
   * Marca ou categoria `null`, `undefined` ou vazia viram parte vazia (ex.: `|<nome>`),
   * e o separador continua lá: com o número de partes fixo por regra, um campo vazio
   * não colide com um campo preenchido.
   */
  buildKey(fields: ProductKeyFields, rule: NormalizationRule): string {
    const parts: (string | null | undefined)[] = [];
    if (rule.includesBrand) parts.push(fields.brand);
    if (rule.includesCategory) parts.push(fields.category);
    parts.push(fields.name);
    return parts.map((part) => this.normalize(part)).join(KEY_SEPARATOR);
  }
}
