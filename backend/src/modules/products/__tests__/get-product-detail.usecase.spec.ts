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

  it('devolve o produto com vários sellers', async () => {
    const product = {
      id: 1,
      name: 'Camisa',
      brand: 'Nike',
      category: null,
      sellers: [
        {
          sellerId: 1,
          sellerName: 'Loja A',
          externalId: 'A-1',
          name: 'Camisa',
          brand: 'Nike',
          category: 'Roupas',
          matchedBy: 'new',
        },
        {
          sellerId: 2,
          sellerName: 'Loja B',
          externalId: null,
          name: 'CAMISA',
          brand: null,
          category: null,
          matchedBy: 'normalized_key',
        },
      ],
    };
    productRepository.findByIdWithSellers.mockResolvedValue(product);

    const result = await sut.execute(1);

    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) expect(result.value).toEqual(product);
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
