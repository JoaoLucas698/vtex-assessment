import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TEMPLATE_EXAMPLE,
  TEMPLATE_FILE_NAME,
  templateJson,
} from '@features/catalog-import/catalog-file-template';
import { FileTemplate } from '@features/catalog-import/file-template';

describe('FileTemplate', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('lista os campos com obrigatório e opcional', () => {
    render(<FileTemplate />);

    const fields = within(screen.getByRole('list', { name: 'Campos do arquivo', hidden: true }));
    const items = fields.getAllByRole('listitem', { hidden: true });
    expect(items.map((item) => item.querySelector('code')?.textContent)).toEqual([
      'Id',
      'SellerName',
      'Name',
      'Brand',
      'Category',
    ]);
    expect(within(items[0]).getByText('obrigatório')).toBeInTheDocument();
    expect(within(items[3]).getByText('opcional')).toBeInTheDocument();
  });

  it('mostra um exemplo que é JSON válido no formato do arquivo', () => {
    render(<FileTemplate />);

    const example = screen.getByLabelText('Exemplo de arquivo');
    expect(JSON.parse(example.textContent ?? '')).toEqual(TEMPLATE_EXAMPLE);
  });

  it('baixa o modelo como arquivo JSON', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:modelo');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const user = userEvent.setup();

    render(<FileTemplate />);
    await user.click(screen.getByText('Formato esperado do arquivo'));
    await user.click(screen.getByRole('button', { name: 'Baixar modelo' }));

    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('application/json');
    expect(await blob.text()).toBe(templateJson());
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe(TEMPLATE_FILE_NAME);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:modelo');
  });
});
