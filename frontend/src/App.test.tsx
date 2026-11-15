import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockReset } from 'vitest-mock-extended';
import App from '@/App';
import { parseRoute } from '@/hooks/use-hash-route';
import { catalogApi } from '@/test/catalog-api-mock';

vi.mock('@api/catalog-api', () => import('@/test/catalog-api-mock'));

describe('App', () => {
  beforeEach(() => {
    mockReset(catalogApi);
    catalogApi.listProducts.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    window.location.hash = '';
  });

  it('mostra título e navegação, com o catálogo como tela inicial', async () => {
    render(<App />);

    expect(screen.getByText('Catalog Consolidation')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Importar' })).toHaveAttribute('href', '#/import');
    expect(await screen.findByRole('heading', { name: 'Catálogo' })).toBeInTheDocument();
  });

  it('interpreta as rotas por hash', () => {
    expect(parseRoute('#/import')).toEqual({ name: 'import' });
    expect(parseRoute('#/products/12')).toEqual({ name: 'product', id: 12 });
    expect(parseRoute('#/products/abc')).toEqual({ name: 'catalog' });
    expect(parseRoute('')).toEqual({ name: 'catalog' });
  });
});