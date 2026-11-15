/** Valores fixos do módulo `catalog-import` (D-038). */

/** Tamanho máximo do arquivo de carga aceito pelo upload (D-083). */
export const MAX_CATALOG_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/** Nome do campo multipart que carrega o arquivo. */
export const CATALOG_FILE_FIELD = 'file';

/** Nomes dos campos de cada item do arquivo de carga (`docs/context.md` §2). */
export const CatalogItemField = {
  ID: 'Id',
  SELLER_NAME: 'SellerName',
  NAME: 'Name',
  BRAND: 'Brand',
  CATEGORY: 'Category',
} as const;

export type CatalogItemFieldName =
  (typeof CatalogItemField)[keyof typeof CatalogItemField];
