/**
 * Tipos de domínio do módulo `catalog-import` ligados à normalização e ao matching
 * (`docs/context.md` §4, D-005, D-012, D-015, D-040).
 */

/**
 * Origem de um vínculo `SellerProduct` (coluna `matchedBy`, D-015).
 * Os valores são os gravados no banco.
 */
export enum MatchedBy {
  /** O item do arquivo criou o produto. */
  NEW = 'new',
  /** O item do arquivo foi ligado a um produto existente pela chave normalizada. */
  NORMALIZED_KEY = 'normalized_key',
  /** O vínculo já existia no banco fornecido e foi trazido pela migration. */
  LEGACY = 'legacy',
}

/** Resultado de cada item no relatório da importação (`docs/context.md` §5). */
export enum ImportItemOutcome {
  /** Produto novo criado a partir do item (`matchedBy = new`). */
  CREATED = 'created',
  /** Item ligado a um produto existente (`matchedBy = normalized_key`). */
  LINKED_EXISTING = 'linked_existing',
  /** Reenvio do mesmo `externalId` pelo mesmo seller: dados do seller atualizados. */
  ALREADY_LINKED = 'already_linked',
  /** Mesmo produto enviado de novo pelo mesmo seller com outro `externalId` (D-012). */
  DUPLICATE_SAME_SELLER = 'duplicate_same_seller',
  /** Item rejeitado na validação (sem `Id`, `SellerName` ou `Name`). */
  INVALID = 'invalid',
}

/** Tipo da decisão tomada pelo `ProductMatchingService` para um item válido. */
export enum MatchDecisionType {
  /** Já existe vínculo com o mesmo `(sellerId, externalId)`: atualiza os dados do seller. */
  ALREADY_LINKED = 'ALREADY_LINKED',
  /** Existe produto com a mesma chave e o seller ainda não está ligado a ele: cria o vínculo. */
  LINK_EXISTING = 'LINK_EXISTING',
  /** Nenhum produto com a chave: cria o produto e o vínculo. */
  CREATE_PRODUCT = 'CREATE_PRODUCT',
  /** O seller já está ligado ao produto da chave com outro `externalId`: não cria nada. */
  DUPLICATE_SAME_SELLER = 'DUPLICATE_SAME_SELLER',
}

/** Vínculo `SellerProduct` existente, no formato mínimo que o matching precisa. */
export interface ExistingSellerLink {
  readonly id: number;
  readonly productId: number;
  readonly externalId: string | null;
}

/** Produto existente, no formato mínimo que o matching precisa. */
export interface ExistingProductRef {
  readonly id: number;
}

/**
 * Dados que o usecase busca **antes** de pedir a decisão, todos dentro da mesma
 * transação da importação:
 * - `linkByExternalId`: vínculo do seller com o mesmo `externalId` do item, ou `null`;
 * - `productByKey`: produto com o mesmo `normalizedKey` do item, ou `null`;
 * - `sellerLinkToProduct`: vínculo do seller com `productByKey`, ou `null`
 *   (só faz sentido quando `productByKey` existe; é ignorado caso contrário).
 */
export interface MatchInput {
  readonly linkByExternalId: ExistingSellerLink | null;
  readonly productByKey: ExistingProductRef | null;
  readonly sellerLinkToProduct: ExistingSellerLink | null;
}

export interface AlreadyLinkedDecision {
  readonly type: MatchDecisionType.ALREADY_LINKED;
  /** Vínculo a atualizar com os dados enviados agora pelo seller. */
  readonly sellerProductId: number;
  readonly productId: number;
}

export interface LinkExistingDecision {
  readonly type: MatchDecisionType.LINK_EXISTING;
  readonly productId: number;
  readonly matchedBy: MatchedBy.NORMALIZED_KEY;
}

export interface CreateProductDecision {
  readonly type: MatchDecisionType.CREATE_PRODUCT;
  readonly matchedBy: MatchedBy.NEW;
}

export interface DuplicateSameSellerDecision {
  readonly type: MatchDecisionType.DUPLICATE_SAME_SELLER;
  readonly productId: number;
  /** Vínculo que prevalece (o primeiro recebido, D-012). */
  readonly existingSellerProductId: number;
  /** `externalId` do vínculo que prevalece (`null` em vínculos legados sem código). */
  readonly existingExternalId: string | null;
}

/** Decisão discriminada pelo campo `type`. */
export type MatchDecision =
  | AlreadyLinkedDecision
  | LinkExistingDecision
  | CreateProductDecision
  | DuplicateSameSellerDecision;

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

/** Arquivo recebido no upload, no formato mínimo que a importação usa. */
export interface UploadedCatalogFile {
  readonly buffer: Buffer;
  readonly size: number;
  readonly originalname?: string;
  readonly mimetype?: string;
}

/**
 * Item válido do arquivo. Os textos são guardados **exatamente** como vieram
 * (o trim só é usado para validar, D-082).
 */
export interface ValidCatalogItem {
  /** Posição do item no array do arquivo (começa em 0). */
  readonly index: number;
  readonly externalId: string;
  readonly sellerName: string;
  readonly name: string;
  readonly brand: string | null;
  readonly category: string | null;
}

/** Item rejeitado na validação (D-011), com o motivo legível. */
export interface InvalidCatalogItem {
  readonly index: number;
  /** Valor recebido quando é texto; `null` quando ausente ou de outro tipo. */
  readonly externalId: string | null;
  readonly sellerName: string | null;
  readonly name: string | null;
  readonly reason: string;
}

/** Resultado do parser: itens separados em válidos e inválidos, na ordem do arquivo. */
export interface ParsedCatalogFile {
  /** Quantidade de itens lidos do array. */
  readonly total: number;
  readonly valid: ValidCatalogItem[];
  readonly invalid: InvalidCatalogItem[];
}

/** Entrada do usecase de importação. `file` ausente vira `FILE_REQUIRED`. */
export interface ImportCatalogInput {
  readonly file: UploadedCatalogFile | null | undefined;
}

/** Linha do relatório: o que aconteceu com um item do arquivo. */
export interface ImportItemReport {
  readonly index: number;
  readonly externalId: string | null;
  readonly sellerName: string | null;
  readonly name: string | null;
  readonly outcome: ImportItemOutcome;
  /** Produto oficial ligado ao item (`null` para inválidos). */
  readonly productId: number | null;
  /** Critério do vínculo (`null` para inválidos e duplicados). */
  readonly matchedBy: string | null;
  /** Motivo (só para inválidos e duplicados no mesmo seller). */
  readonly reason: string | null;
}

export interface ImportTotals {
  readonly read: number;
  readonly invalid: number;
  readonly created: number;
  readonly linkedExisting: number;
  readonly alreadyLinked: number;
  readonly duplicateSameSeller: number;
}

export interface ImportCatalogOutput {
  readonly totals: ImportTotals;
  readonly items: ImportItemReport[];
}
