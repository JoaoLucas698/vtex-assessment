import type {
  PaginatedOutput,
  PaginatedResult,
  PaginationParams,
} from '@shared/pagination/pagination.types';

/** Produto oficial como aparece na listagem. */
export interface ProductListItem {
  id: number;
  name: string;
  brand: string | null;
  category: string | null;
  sellersCount: number;
}

export interface ProductSearchParams extends PaginationParams {
  /** Termo já normalizado (ver `ProductNormalizerService.normalize`). Vazio não filtra. */
  q: string;
}

export type ProductSearchResult = PaginatedResult<ProductListItem>;

export interface CreateProductData {
  name: string;
  brand: string | null;
  category: string | null;
  normalizedKey: string;
}

/** Produto oficial, sem o vínculo com sellers. */
export interface ProductRecord {
  id: number;
  name: string;
  brand: string | null;
  category: string | null;
  normalizedKey: string;
}

/** Dados de um seller sobre o produto, exatamente como ele enviou. */
export interface ProductSellerEntry {
  sellerId: number;
  sellerName: string;
  externalId: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  matchedBy: string;
}

export interface ProductWithSellers {
  id: number;
  name: string;
  brand: string | null;
  category: string | null;
  sellers: ProductSellerEntry[];
}

export interface ListProductsInput extends PaginationParams {
  q?: string;
}

export type ListProductsOutput = PaginatedOutput<ProductListItem>;
