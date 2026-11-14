import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { SellerProductRepository } from '@modules/sellers/repositories/seller-product.repository';
import { SellerRepository } from '@modules/sellers/repositories/seller.repository';
import { SellerErrorCode } from '@modules/sellers/schemas/sellers.errors';
import { ListSellerProductsUseCase } from '@modules/sellers/usecases/list-seller-products.usecase';
import { CommonErrorCode } from '@shared/errors/error-codes';

describe('ListSellerProductsUseCase', () => {
  let sut: ListSellerProductsUseCase;
  let sellerRepository: DeepMockProxy<SellerRepository>;
  let sellerProductRepository: DeepMockProxy<SellerProductRepository>;
  const now = new Date();
  const seller = {
    id: 1,
    sellerName: 'Loja A',
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(() => {
    sellerRepository = mockDeep<SellerRepository>();
    sellerProductRepository = mockDeep<SellerProductRepository>();
    sut = new ListSellerProductsUseCase(
      sellerRepository,
      sellerProductRepository,
    );
  });

  it('retorna erro SELLER_NOT_FOUND quando o seller não existe', async () => {
    sellerRepository.findById.mockResolvedValue(null);

    const result = await sut.execute({ sellerId: 99, page: 1, pageSize: 20 });

    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error.code).toBe(SellerErrorCode.SELLER_NOT_FOUND);
    }
    expect(sellerProductRepository.listBySeller).not.toHaveBeenCalled();
  });

  it('retorna erro de validação para paginação inválida', async () => {
    const result = await sut.execute({ sellerId: 1, page: 0, pageSize: 20 });

    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error.code).toBe(CommonErrorCode.VALIDATION_ERROR);
    }
    expect(sellerRepository.findById).not.toHaveBeenCalled();
  });

  it('preserva null em brand, category e externalId e inclui o produto oficial', async () => {
    sellerRepository.findById.mockResolvedValue(seller);
    sellerProductRepository.listBySeller.mockResolvedValue({
      items: [
        {
          id: 7,
          productId: 10,
          sellerId: 1,
          externalId: null,
          name: 'Produto X',
          brand: null,
          category: null,
          matchedBy: 'legacy',
          createdAt: now,
          updatedAt: now,
          product: { id: 10, name: 'Produto Oficial' },
        },
      ],
      total: 1,
    });

    const result = await sut.execute({ sellerId: 1, page: 1, pageSize: 20 });

    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.value.seller).toEqual({ id: 1, sellerName: 'Loja A' });
      expect(result.value.items).toEqual([
        {
          id: 7,
          externalId: null,
          name: 'Produto X',
          brand: null,
          category: null,
          matchedBy: 'legacy',
          product: { id: 10, name: 'Produto Oficial' },
        },
      ]);
    }
  });

  it('repassa a paginação ao repository', async () => {
    sellerRepository.findById.mockResolvedValue(seller);
    sellerProductRepository.listBySeller.mockResolvedValue({
      items: [],
      total: 0,
    });

    const result = await sut.execute({ sellerId: 1, page: 3, pageSize: 5 });

    expect(result.isSuccess).toBe(true);
    expect(sellerProductRepository.listBySeller).toHaveBeenCalledWith(1, {
      page: 3,
      pageSize: 5,
    });
  });
});
