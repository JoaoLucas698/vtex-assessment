// Tipos espelhando os response DTOs do backend.

export const ImportOutcome = {
  CREATED: 'created',
  LINKED_EXISTING: 'linked_existing',
  ALREADY_LINKED: 'already_linked',
  DUPLICATE_SAME_SELLER: 'duplicate_same_seller',
  INVALID: 'invalid',
} as const;
export type ImportOutcome = (typeof ImportOutcome)[keyof typeof ImportOutcome];

export type MatchedBy = 'new' | 'normalized_key' | 'legacy';

export interface ImportTotals {
  read: number;
  invalid: number;
  created: number;
  linkedExisting: number;
  alreadyLinked: number;
  duplicateSameSeller: number;
}

export interface ImportItem {
  index: number;
  externalId: string | null;
  sellerName: string | null;
  name: string | null;
  outcome: ImportOutcome;
  productId: number | null;
  matchedBy: MatchedBy | null;
  reason: string | null;
}

export interface ImportCatalogResponse {
  totals: ImportTotals;
  items: ImportItem[];
}

export interface ProductListItem {
  id: number;
  name: string;
  brand: string | null;
  category: string | null;
  sellersCount: number;
}

export interface ListProductsResponse {
  items: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListProductsParams {
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface ProductSeller {
  sellerId: number;
  sellerName: string;
  externalId: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  matchedBy: MatchedBy;
}

export interface ProductDetailResponse {
  id: number;
  name: string;
  brand: string | null;
  category: string | null;
  sellers: ProductSeller[];
}