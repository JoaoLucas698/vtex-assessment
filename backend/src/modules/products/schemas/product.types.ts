/** Produto oficial como aparece na listagem. */
export interface ProductListItem {
  id: number;
  name: string;
  brand: string | null;
  category: string | null;
  sellersCount: number;
}

export interface ProductSearchParams {
  /** Termo já normalizado (ver `ProductNormalizerService.normalize`). Vazio não filtra. */
  q: string;
  page: number;
  pageSize: number;
}

export interface ProductSearchResult {
  items: ProductListItem[];
  total: number;
}

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

export interface ListProductsInput {
  q?: string;
  page: number;
  pageSize: number;
}

export interface ListProductsOutput {
  items: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
}
