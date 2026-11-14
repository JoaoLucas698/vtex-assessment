import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockReset } from 'vitest-mock-extended';
import { ApiError } from '@api/api-error';
import type { ImportCatalogResponse } from '@api/types';
import { ImportPage } from '@features/catalog-import/import-page';
import { catalogApi } from '@/test/catalog-api-mock';

vi.mock('@api/catalog-api', () => import('@/test/catalog-api-mock'));

const report: ImportCatalogResponse = {
  totals: { read: 4, invalid: 1, created: 1, linkedExisting: 1, alreadyLinked: 0, duplicateSameSeller: 1 },
  items: [
    { index: 0, externalId: 'a', sellerName: 'MegaStore', name: 'Galaxy S23', outcome: 'created', productId: 10, matchedBy: 'new', reason: null },
    { index: 1, externalId: 'b', sellerName: 'TechWorld', name: 'galaxy s23', outcome: 'linked_existing', productId: 10, matchedBy: 'normalized_key', reason: null },
    { index: 2, externalId: 'c', sellerName: 'TechWorld', name: 'Galaxy S23', outcome: 'duplicate_same_seller', productId: 10, matchedBy: null, reason: 'Já enviado' },
    { index: 3, externalId: null, sellerName: null, name: null, outcome: 'invalid', productId: null, matchedBy: null, reason: 'Id ausente' },
  ],
};

const file = new File(['[]'], 'carga.json', { type: 'application/json' });

async function upload(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup();
  await user.upload(screen.getByLabelText(/Arquivo JSON/), file);
  await user.click(screen.getByRole('button', { name: 'Enviar' }));
  return user;
}

describe('ImportPage', () => {
  beforeEach(() => {
    mockReset(catalogApi);
  });

  it('mostra estado vazio e botão desabilitado sem arquivo', () => {
    render(<ImportPage />);

    expect(screen.getByText('Nenhum arquivo enviado ainda.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
  });

  it('mostra carregamento durante o envio', async () => {
    catalogApi.importCatalog.mockReturnValue(new Promise(() => undefined));

    render(<ImportPage />);
    await upload();

    expect(screen.getByText('Importando...')).toBeInTheDocument();
    expect(catalogApi.importCatalog).toHaveBeenCalledWith(file);
  });

  it('mostra totais, itens e link para o produto', async () => {
    catalogApi.importCatalog.mockResolvedValue(report);

    render(<ImportPage />);
    await upload();

    expect(await screen.findByTestId('total-Lidos')).toHaveTextContent('4');
    expect(screen.getByTestId('total-Criados')).toHaveTextContent('1');
    expect(screen.getByTestId('total-Inválidos')).toHaveTextContent('1');
    expect(screen.getByTestId('total-Duplicados do mesmo seller')).toHaveTextContent('1');
    expect(screen.getAllByRole('row')).toHaveLength(5);
    const links = screen.getAllByRole('link', { name: /galaxy s23/i });
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute('href', '#/products/10');
    expect(screen.getByText('Id ausente')).toBeInTheDocument();
  });

  it('filtra por outcome e mostra vazio quando nada bate', async () => {
    catalogApi.importCatalog.mockResolvedValue(report);

    render(<ImportPage />);
    const user = await upload();
    await screen.findByTestId('total-Lidos');

    await user.selectOptions(screen.getByLabelText(/Filtrar/), 'invalid');
    expect(screen.getAllByRole('row')).toHaveLength(2);

    await user.selectOptions(screen.getByLabelText(/Filtrar/), 'already_linked');
    expect(screen.getByText('Nenhum item para este filtro.')).toBeInTheDocument();
  });

  it('mostra erro da API', async () => {
    catalogApi.importCatalog.mockRejectedValue(new ApiError('INVALID_FILE', 'Arquivo inválido', 400));

    render(<ImportPage />);
    await upload();

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Arquivo inválido (INVALID_FILE)')).toBeInTheDocument();
  });
});