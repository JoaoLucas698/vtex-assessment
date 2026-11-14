import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockReset } from 'vitest-mock-extended';
import { ApiError } from '@api/api-error';
import type { ListProductsResponse } from '@api/types';
import { CatalogPage } from '@features/catalog/catalog-page';
import { catalogApi } from '@/test/catalog-api-mock';

vi.mock('@api/catalog-api', () => import('@/test/catalog-api-mock'));

const page: ListProductsResponse = {
  items: [
    { id: 1, name: 'Galaxy S23', brand: 'Samsung', category: 'Electronics', sellersCount: 3 },
    { id: 2, name: 'iPhone 15 Pro', brand: null, category: null, sellersCount: 1 },
  ],
  total: 45,
  page: 1,
  pageSize: 20,
};

describe('CatalogPage', () => {
  beforeEach(() => {
    mockReset(catalogApi);
  });

  it('mostra carregamento enquanto a lista não chega', () => {
    catalogApi.listProducts.mockReturnValue(new Promise(() => undefined));

    render(<CatalogPage />);

    expect(screen.getByText('Carregando produtos...')).toBeInTheDocument();
  });

  it('lista produtos com contagem de sellers e link para o detalhe', async () => {
    catalogApi.listProducts.mockResolvedValue(page);

    render(<CatalogPage />);

    const link = await screen.findByRole('link', { name: 'Galaxy S23' });
    expect(link).toHaveAttribute('href', '#/products/1');
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('45 produto(s)')).toBeInTheDocument();
  });

  it('mostra erro da API', async () => {
    catalogApi.listProducts.mockRejectedValue(new ApiError('INTERNAL_ERROR', 'Erro interno', 500));

    render(<CatalogPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Erro interno (INTERNAL_ERROR)');
  });

  it('mostra estado vazio', async () => {
    catalogApi.listProducts.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

    render(<CatalogPage />);

    expect(await screen.findByText('Nenhum produto encontrado.')).toBeInTheDocument();
  });

  it('busca e pagina chamando a API com os parâmetros', async () => {
    catalogApi.listProducts.mockResolvedValue(page);
    const user = userEvent.setup();

    render(<CatalogPage />);
    await screen.findByRole('link', { name: 'Galaxy S23' });

    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await screen.findByText('Página 1 de 3');
    expect(catalogApi.listProducts).toHaveBeenLastCalledWith({ q: '', page: 2, pageSize: 20 });

    await user.type(screen.getByLabelText(/Buscar/), 'galaxy');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await screen.findByRole('link', { name: 'Galaxy S23' });
    expect(catalogApi.listProducts).toHaveBeenLastCalledWith({ q: 'galaxy', page: 1, pageSize: 20 });
  });
});