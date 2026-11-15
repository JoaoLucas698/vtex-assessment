import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { SellerProductRepository } from '@modules/sellers/repositories/seller-product.repository';
import { SellerRepository } from '@modules/sellers/repositories/seller.repository';
import { SellerErrorCode } from '@modules/sellers/schemas/sellers.errors';
import { SellerProductViewService } from '@modules/sellers/services/seller-product-view.service';
import { ListSellerProductsUseCase } from '@modules/sellers/usecases/list-seller-products.usecase';
import { CommonErrorCode } from '@shared/errors/error-codes';

describe('ListSellerProductsUseCase', () => {
  let sut: ListSellerProductsUseCase;
  let sellerRepository: DeepMockProxy<SellerRepository>;
  let sellerProductRepository: DeepMockProxy<SellerProductRepository>;
  let sellerProductViewService: DeepMockProxy<SellerProductViewService>;
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
    sellerProductViewService = mockDeep<SellerProductViewService>();
    sut = new ListSellerProductsUseCase(
      sellerRepository,
      sellerProductRepository,
      sellerProductViewService,
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

  it('monta cada item pelo SellerProductViewService e inclui o seller', async () => {
    const link = {
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
      product: {
        id: 10,
        name: 'Produto Oficial',
        brand: 'Marca Oficial',
        category: 'Cat Oficial',
      },
    };
    const item = {
      id: 7,
      externalId: null,
      name: 'Produto X',
      brand: 'Marca Oficial',
      category: 'Cat Oficial',
      matchedBy: 'legacy',
      product: { id: 10, name: 'Produto Oficial' },
    };
    sellerRepository.findById.mockResolvedValue(seller);
    sellerProductRepository.listBySeller.mockResolvedValue({
      items: [link],
      total: 1,
    });
    sellerProductViewService.toOutput.mockReturnValue(item);

    const result = await sut.execute({ sellerId: 1, page: 1, pageSize: 20 });

    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.value.seller).toEqual({ id: 1, sellerName: 'Loja A' });
      expect(result.value.items).toEqual([item]);
      expect(result.value.total).toBe(1);
    }
    expect(sellerProductViewService.toOutput).toHaveBeenCalledWith(link);
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
