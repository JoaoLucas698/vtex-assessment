import { SellerProductViewService } from '@modules/sellers/services/seller-product-view.service';
import type { SellerProductWithProduct } from '@modules/sellers/schemas/seller.types';

describe('SellerProductViewService', () => {
  let sut: SellerProductViewService;
  const now = new Date();

  const buildLink = (
    overrides: Partial<SellerProductWithProduct> = {},
  ): SellerProductWithProduct => ({
    id: 7,
    productId: 10,
    sellerId: 1,
    externalId: 'SKU-1',
    name: 'Produto X',
    brand: 'Marca Seller',
    category: 'Cat Seller',
    matchedBy: 'normalized_key',
    createdAt: now,
    updatedAt: now,
    product: {
      id: 10,
      name: 'Produto Oficial',
      brand: 'Marca Oficial',
      category: 'Cat Oficial',
    },
    ...overrides,
  });

  beforeEach(() => {
    sut = new SellerProductViewService();
  });

  it('usa os dados do seller quando ele informou', () => {
    const output = sut.toOutput(buildLink());

    expect(output).toEqual({
      id: 7,
      externalId: 'SKU-1',
      name: 'Produto X',
      brand: 'Marca Seller',
      category: 'Cat Seller',
      matchedBy: 'normalized_key',
      product: { id: 10, name: 'Produto Oficial' },
    });
  });

  it('usa marca e categoria do produto oficial quando o seller mandou null', () => {
    const output = sut.toOutput(buildLink({ brand: null, category: null }));

    expect(output.brand).toBe('Marca Oficial');
    expect(output.category).toBe('Cat Oficial');
  });

  it('cai para o oficial campo a campo', () => {
    const output = sut.toOutput(buildLink({ brand: null }));

    expect(output.brand).toBe('Marca Oficial');
    expect(output.category).toBe('Cat Seller');
  });

  it('mantém texto vazio do seller (só null usa o oficial)', () => {
    const output = sut.toOutput(buildLink({ brand: '' }));

    expect(output.brand).toBe('');
  });

  it('devolve null quando seller e produto oficial não têm o dado', () => {
    const link = buildLink({ brand: null, category: null });
    const output = sut.toOutput({
      ...link,
      product: { ...link.product, brand: null, category: null },
    });

    expect(output.brand).toBeNull();
    expect(output.category).toBeNull();
  });

  it('não preenche externalId com nada do produto', () => {
    const output = sut.toOutput(buildLink({ externalId: null }));

    expect(output.externalId).toBeNull();
  });
});
