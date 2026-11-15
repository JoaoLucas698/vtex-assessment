/** Tipos de domínio do módulo `sellers` (derivados dos tipos gerados pelo Prisma). */
import type { Product, Seller, SellerProduct } from '@prisma/client';
import type {
  PaginatedOutput,
  PaginationParams,
} from '@shared/pagination/pagination.types';

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

export type ListSellersOutput = PaginatedOutput<SellerSummaryOutput>;

export interface SellerProductOutput {
  readonly id: number;
  readonly externalId: string | null;
  readonly name: string;
  readonly brand: string | null;
  readonly category: string | null;
  readonly matchedBy: string;
  readonly product: { readonly id: number; readonly name: string };
}

export type ListSellerProductsOutput = PaginatedOutput<SellerProductOutput> & {
  readonly seller: { readonly id: number; readonly sellerName: string };
};
