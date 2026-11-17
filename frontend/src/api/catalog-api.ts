import { request } from '@api/http';
import type {
  ImportCatalogResponse,
  ListNormalizationTypesResponse,
  ListProductsParams,
  NormalizationTypeCode,
  ListProductsResponse,
  ProductDetailResponse,
} from '@api/types';

export interface CatalogApi {
  importCatalog(file: File, normalizationType?: NormalizationTypeCode): Promise<ImportCatalogResponse>;
  listNormalizationTypes(): Promise<ListNormalizationTypesResponse>;
  listProducts(params: ListProductsParams): Promise<ListProductsResponse>;
  getProduct(id: number): Promise<ProductDetailResponse>;
}

export const catalogApi: CatalogApi = {
  listNormalizationTypes() {
    return request<ListNormalizationTypesResponse>('/api/normalization-types');
  },

  importCatalog(file, normalizationType) {
    const form = new FormData();
    form.append('file', file);
    if (normalizationType) form.append('normalizationType', normalizationType);
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