import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { SellerRepository } from '@modules/sellers/repositories/seller.repository';
import { CommonErrorCode } from '@shared/errors/error-codes';
import { ListSellersUseCase } from '@modules/sellers/usecases/list-sellers.usecase';

describe('ListSellersUseCase', () => {
  let sut: ListSellersUseCase;
  let sellerRepository: DeepMockProxy<SellerRepository>;
  const now = new Date();

  beforeEach(() => {
    sellerRepository = mockDeep<SellerRepository>();
    sut = new ListSellersUseCase(sellerRepository);
  });

  it('lista sellers com a quantidade de produtos e a paginação', async () => {
    sellerRepository.list.mockResolvedValue({
      items: [
        {
          id: 1,
          sellerName: 'Loja A',
          createdAt: now,
          updatedAt: now,
          productCount: 3,
        },
      ],
      total: 11,
    });

    const result = await sut.execute({ page: 2, pageSize: 10 });

    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.value).toEqual({
        items: [{ id: 1, sellerName: 'Loja A', productCount: 3 }],
        total: 11,
        page: 2,
        pageSize: 10,
      });
    }
    expect(sellerRepository.list).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
    });
  });

  it('retorna lista vazia quando não há sellers', async () => {
    sellerRepository.list.mockResolvedValue({ items: [], total: 0 });

    const result = await sut.execute({ page: 1, pageSize: 20 });

    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) expect(result.value.items).toEqual([]);
  });

  it.each([
    { page: 0, pageSize: 20 },
    { page: 1, pageSize: 0 },
    { page: 1.5, pageSize: 20 },
    { page: 1, pageSize: 101 },
  ])('retorna erro de validação para paginação inválida %j', async (input) => {
    const result = await sut.execute(input);

    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error.code).toBe(CommonErrorCode.VALIDATION_ERROR);
    }
    expect(sellerRepository.list).not.toHaveBeenCalled();
  });
});
