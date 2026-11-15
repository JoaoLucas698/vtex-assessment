import { fillFromOfficialProduct } from '@shared/catalog/fill-from-official-product';

describe('fillFromOfficialProduct', () => {
  const official = { brand: 'Marca Oficial', category: 'Cat Oficial' };

  it('mantém os dados do seller quando ele informou', () => {
    const seller = { id: 1, brand: 'Marca Seller', category: 'Cat Seller' };

    expect(fillFromOfficialProduct(seller, official)).toEqual(seller);
  });

  it('usa marca e categoria do oficial quando o seller mandou null', () => {
    const result = fillFromOfficialProduct(
      { id: 1, brand: null, category: null },
      official,
    );

    expect(result).toEqual({
      id: 1,
      brand: 'Marca Oficial',
      category: 'Cat Oficial',
    });
  });

  it('cai para o oficial campo a campo', () => {
    const result = fillFromOfficialProduct(
      { brand: null, category: 'Cat Seller' },
      official,
    );

    expect(result).toEqual({ brand: 'Marca Oficial', category: 'Cat Seller' });
  });

  it('mantém texto vazio do seller (só null usa o oficial)', () => {
    const result = fillFromOfficialProduct(
      { brand: '', category: '' },
      official,
    );

    expect(result).toEqual({ brand: '', category: '' });
  });

  it('devolve null quando seller e oficial não têm o dado', () => {
    const result = fillFromOfficialProduct(
      { brand: null, category: null },
      { brand: null, category: null },
    );

    expect(result).toEqual({ brand: null, category: null });
  });

  it('preserva os outros campos e não altera o objeto original', () => {
    const seller = { externalId: null, name: 'X', brand: null, category: null };

    const result = fillFromOfficialProduct(seller, official);

    expect(result.externalId).toBeNull();
    expect(result.name).toBe('X');
    expect(seller.brand).toBeNull();
  });
});
