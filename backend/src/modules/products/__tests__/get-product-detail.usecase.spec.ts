import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { ProductRepository } from '@modules/products/repositories/product.repository';
import { ProductsErrorCode } from '@modules/products/schemas/products.errors';
import { GetProductDetailUseCase } from '@modules/products/usecases/get-product-detail.usecase';

describe('GetProductDetailUseCase', () => {
  let sut: GetProductDetailUseCase;
  let productRepository: DeepMockProxy<ProductRepository>;

  beforeEach(() => {
    productRepository = mockDeep<ProductRepository>();
    sut = new GetProductDetailUseCase(productRepository);
  });

  const sellerA = {
    sellerId: 1,
    sellerName: 'Loja A',
    externalId: 'A-1',
    name: 'Camisa',
    brand: 'Nike BR',
    category: 'Roupas',
    matchedBy: 'new',
  };
  const sellerB = {
    sellerId: 2,
    sellerName: 'Loja B',
    externalId: null,
    name: 'CAMISA',
    brand: null,
    category: null,
    matchedBy: 'normalized_key',
  };
  const product = {
    id: 1,
    name: 'Camisa',
    brand: 'Nike',
    category: 'Vestuário',
    sellers: [sellerA, sellerB],
  };

  it('devolve o produto com vários sellers, mantendo o que cada um enviou', async () => {
    productRepository.findByIdWithSellers.mockResolvedValue(product);

    const result = await sut.execute(1);

    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.value).toMatchObject({
        id: 1,
        name: 'Camisa',
        brand: 'Nike',
        category: 'Vestuário',
      });
      expect(result.value.sellers[0]).toEqual(sellerA);
    }
  });

  it('usa marca e categoria do produto oficial quando o seller mandou null', async () => {
    productRepository.findByIdWithSellers.mockResolvedValue(product);

    const result = await sut.execute(1);

    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.value.sellers[1]).toEqual({
        ...sellerB,
        brand: 'Nike',
        category: 'Vestuário',
        externalId: null,
      });
    }
  });

  it('cai para o oficial campo a campo e mantém texto vazio do seller', async () => {
    productRepository.findByIdWithSellers.mockResolvedValue({
      ...product,
      sellers: [{ ...sellerB, brand: '', category: null }],
    });

    const result = await sut.execute(1);

    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.value.sellers[0].brand).toBe('');
      expect(result.value.sellers[0].category).toBe('Vestuário');
    }
  });

  it('devolve null quando seller e produto oficial não têm o dado', async () => {
    productRepository.findByIdWithSellers.mockResolvedValue({
      ...product,
      brand: null,
      category: null,
      sellers: [sellerB],
    });

    const result = await sut.execute(1);

    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.value.sellers[0].brand).toBeNull();
      expect(result.value.sellers[0].category).toBeNull();
    }
  });

  it('retorna PRODUCT_NOT_FOUND quando o produto não existe', async () => {
    productRepository.findByIdWithSellers.mockResolvedValue(null);

    const result = await sut.execute(999);

    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error.code).toBe(ProductsErrorCode.PRODUCT_NOT_FOUND);
    }
  });
});
