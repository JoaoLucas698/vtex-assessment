import { request } from '@api/http';
import type {
  ImportCatalogResponse,
  ListProductsParams,
  ListProductsResponse,
  ProductDetailResponse,
} from '@api/types';

export interface CatalogApi {
  importCatalog(file: File): Promise<ImportCatalogResponse>;
  listProducts(params: ListProductsParams): Promise<ListProductsResponse>;
  getProduct(id: number): Promise<ProductDetailResponse>;
}

export const catalogApi: CatalogApi = {
  importCatalog(file) {
    const form = new FormData();
    form.append('file', file);
    return request<ImportCatalogResponse>('/api/catalog-import', { method: 'POST', body: form });
  },

  listProducts({ q, page, pageSize }) {
    const query = new URLSearchParams();
    if (q) query.set('q', q);
    if (page) query.set('page', String(page));
    if (pageSize) query.set('pageSize', String(pageSize));
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    return request<ListProductsResponse>(`/api/products${suffix}`);
  },

  getProduct(id) {
    return request<ProductDetailResponse>(`/api/products/${id}`);
  },
};