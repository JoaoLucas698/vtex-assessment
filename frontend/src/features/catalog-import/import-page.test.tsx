import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockReset } from 'vitest-mock-extended';
import { ApiError } from '@api/api-error';
import type { ImportCatalogResponse, ListNormalizationTypesResponse } from '@api/types';
import { ImportPage } from '@features/catalog-import/import-page';
import { catalogApi } from '@/test/catalog-api-mock';

vi.mock('@api/catalog-api', () => import('@/test/catalog-api-mock'));

const types: ListNormalizationTypesResponse = {
  items: [
    { id: 1, code: 'NAME_BRAND', description: 'Nome + Marca', includesBrand: true, includesCategory: false },
    { id: 2, code: 'NAME_CATEGORY', description: 'Nome + Categoria', includesBrand: false, includesCategory: true },
    { id: 3, code: 'NAME_BRAND_CATEGORY', description: 'Nome + Marca + Categoria', includesBrand: true, includesCategory: true },
  ],
};

const report: ImportCatalogResponse = {
  normalizationType: 'NAME_BRAND',
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
    catalogApi.listNormalizationTypes.mockResolvedValue(types);
  });

  it('carrega as regras de normalização com NAME_BRAND como padrão', async () => {
    render(<ImportPage />);

    const select = await screen.findByLabelText(/Regra de normalização/);
    expect(within(select).getAllByRole('option')).toHaveLength(3);
    expect(select).toHaveValue('NAME_BRAND');
    expect(screen.getByText(/mantêm a própria regra/)).toBeInTheDocument();
  });

  it('mostra carregamento das regras', () => {
    catalogApi.listNormalizationTypes.mockReturnValue(new Promise(() => undefined));

    render(<ImportPage />);

    expect(screen.getByText('Carregando regras de normalização...')).toBeInTheDocument();
  });

  it('mostra erro ao carregar as regras', async () => {
    catalogApi.listNormalizationTypes.mockRejectedValue(new ApiError('NETWORK_ERROR', 'Sem rede', 0));

    render(<ImportPage />);

    expect(await screen.findByText(/Sem rede/)).toBeInTheDocument();
  });

  it('mostra vazio quando não há regras', async () => {
    catalogApi.listNormalizationTypes.mockResolvedValue({ items: [] });

    render(<ImportPage />);

    expect(await screen.findByText('Nenhuma regra de normalização disponível.')).toBeInTheDocument();
  });

  it('envia a regra escolhida e mostra a regra usada no relatório', async () => {
    catalogApi.importCatalog.mockResolvedValue({ ...report, normalizationType: 'NAME_CATEGORY' });

    render(<ImportPage />);
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByLabelText(/Regra de normalização/), 'NAME_CATEGORY');
    await user.upload(screen.getByLabelText(/Arquivo JSON/), file);
    await user.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(catalogApi.importCatalog).toHaveBeenCalledWith(file, 'NAME_CATEGORY');
    expect(await screen.findByText('NAME_CATEGORY')).toBeInTheDocument();
  });

  it('mostra estado vazio e botão desabilitado sem arquivo', () => {
    render(<ImportPage />);

    expect(screen.getByText('Nenhum arquivo enviado ainda.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
  });

  it('mostra carregamento durante o envio', async () => {
    catalogApi.importCatalog.mockReturnValue(new Promise(() => undefined));

    render(<ImportPage />);
    await screen.findByLabelText(/Regra de normalização/);
    await upload();

    expect(screen.getByText('Importando...')).toBeInTheDocument();
    expect(catalogApi.importCatalog).toHaveBeenCalledWith(file, 'NAME_BRAND');
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