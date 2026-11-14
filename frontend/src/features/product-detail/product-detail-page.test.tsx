import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockReset } from 'vitest-mock-extended';
import { ApiError } from '@api/api-error';
import type { ProductDetailResponse } from '@api/types';
import { ProductDetailPage } from '@features/product-detail/product-detail-page';
import { catalogApi } from '@/test/catalog-api-mock';

vi.mock('@api/catalog-api', () => import('@/test/catalog-api-mock'));

const MALICIOUS = "TestBrand'; SELECT 1; --";

const product: ProductDetailResponse = {
  id: 7,
  name: 'Galaxy S23',
  brand: 'Samsung',
  category: 'Electronics',
  sellers: [
    { sellerId: 1, sellerName: 'MegaStore', externalId: 'a-1', name: 'Galaxy S23', brand: 'Samsung', category: 'Electronics', matchedBy: 'new' },
    { sellerId: 2, sellerName: 'TechWorld', externalId: 'b-2', name: 'galaxy  s23 ', brand: 'SAMSUNG', category: null, matchedBy: 'normalized_key' },
    { sellerId: 3, sellerName: 'Shady', externalId: null, name: 'Galaxy S23', brand: MALICIOUS, category: 'Electronics', matchedBy: 'legacy' },
  ],
};

describe('ProductDetailPage', () => {
  beforeEach(() => {
    mockReset(catalogApi);
  });

  it('mostra carregamento', () => {
    catalogApi.getProduct.mockReturnValue(new Promise(() => undefined));

    render(<ProductDetailPage id={7} />);

    expect(screen.getByText('Carregando produto...')).toBeInTheDocument();
  });

  it('mostra dados oficiais e todos os sellers, destacando diferenças', async () => {
    catalogApi.getProduct.mockResolvedValue(product);

    render(<ProductDetailPage id={7} />);

    expect(await screen.findByRole('heading', { name: 'Galaxy S23' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sellers (3)' })).toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).queryByText('difere do oficial')).not.toBeInTheDocument();
    expect(within(rows[1]).getAllByText('difere do oficial')).toHaveLength(3);
    expect(within(rows[1]).getByText('normalized_key')).toBeInTheDocument();
    expect(catalogApi.getProduct).toHaveBeenCalledWith(7);
  });

  it('exibe brand malicioso como texto puro', async () => {
    catalogApi.getProduct.mockResolvedValue(product);

    render(<ProductDetailPage id={7} />);

    const cell = await screen.findByText(MALICIOUS, { exact: false });
    expect(cell.textContent).toContain(MALICIOUS);
    expect(cell.querySelector('script')).toBeNull();
  });

  it('mostra mensagem de produto não encontrado', async () => {
    catalogApi.getProduct.mockRejectedValue(new ApiError('PRODUCT_NOT_FOUND', 'x', 404));

    render(<ProductDetailPage id={99} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Produto não encontrado.');
  });

  it('mostra erro genérico', async () => {
    catalogApi.getProduct.mockRejectedValue(new ApiError('NETWORK_ERROR', 'Sem rede', 0));

    render(<ProductDetailPage id={7} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Sem rede (NETWORK_ERROR)');
  });

  it('mostra estado vazio quando não há sellers', async () => {
    catalogApi.getProduct.mockResolvedValue({ ...product, sellers: [] });

    render(<ProductDetailPage id={7} />);

    expect(await screen.findByText('Nenhum seller oferece este produto.')).toBeInTheDocument();
  });
});