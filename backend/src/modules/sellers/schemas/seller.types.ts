/** Tipos de domínio do módulo `sellers` (derivados dos tipos gerados pelo Prisma). */
import type { Product, Seller, SellerProduct } from '@prisma/client';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PaginationParams {
  readonly page: number;
  readonly pageSize: number;
}

export interface PaginatedResult<T> {
  readonly items: T[];
  readonly total: number;
}

export type SellerWithProductCount = Seller & { productCount: number };

export type SellerProductWithProduct = SellerProduct & {
  product: Pick<Product, 'id' | 'name' | 'brand' | 'category'>;
};

/**
 * Dados para criar um vínculo seller ↔ produto. D-014: `null` = seller não
 * informou; é gravado assim, e só a leitura usa o dado do produto oficial.
 */
export interface CreateSellerProductData {
  readonly productId: number;
  readonly sellerId: number;
  readonly externalId: string | null;
  readonly name: string;
  readonly brand: string | null;
  readonly category: string | null;
  readonly matchedBy: string;
}

export interface SellerDataUpdate {
  readonly name: string;
  readonly brand: string | null;
  readonly category: string | null;
}

export type ListSellersInput = PaginationParams;

export interface ListSellerProductsInput extends PaginationParams {
  readonly sellerId: number;
}

export interface SellerSummaryOutput {
  readonly id: number;
  readonly sellerName: string;
  readonly productCount: number;
}

export interface ListSellersOutput {
  readonly items: SellerSummaryOutput[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface SellerProductOutput {
  readonly id: number;
  readonly externalId: string | null;
  readonly name: string;
  readonly brand: string | null;
  readonly category: string | null;
  readonly matchedBy: string;
  readonly product: { readonly id: number; readonly name: string };
}

export interface ListSellerProductsOutput {
  readonly seller: { readonly id: number; readonly sellerName: string };
  readonly items: SellerProductOutput[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}
