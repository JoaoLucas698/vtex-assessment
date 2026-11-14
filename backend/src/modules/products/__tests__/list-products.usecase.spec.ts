import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { ProductNormalizerService } from '@modules/catalog-import/services/product-normalizer.service';
import { ProductRepository } from '@modules/products/repositories/product.repository';
import { ListProductsUseCase } from '@modules/products/usecases/list-products.usecase';

describe('ListProductsUseCase', () => {
  let sut: ListProductsUseCase;
  let productRepository: DeepMockProxy<ProductRepository>;

  beforeEach(() => {
    productRepository = mockDeep<ProductRepository>();
    sut = new ListProductsUseCase(
      productRepository,
      new ProductNormalizerService(),
    );
  });

  it('devolve lista vazia quando não há produtos', async () => {
    productRepository.search.mockResolvedValue({ items: [], total: 0 });

    const result = await sut.execute({ page: 1, pageSize: 20 });

    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.value).toEqual({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      });
    }
  });

  it('repassa a paginação e devolve total, page e pageSize', async () => {
    const items = [
      { id: 21, name: 'A', brand: null, category: null, sellersCount: 2 },
    ];
    productRepository.search.mockResolvedValue({ items, total: 41 });

    const result = await sut.execute({ page: 2, pageSize: 20 });

    expect(productRepository.search).toHaveBeenCalledWith({
      q: '',
      page: 2,
      pageSize: 20,
    });
    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.value).toEqual({ items, total: 41, page: 2, pageSize: 20 });
    }
  });

  it.each(['TÊNIS Nike', 'tenis nike', '  tênis   nike  ', "Tênis 'Nike'"])(
    'normaliza o termo "%s" antes de buscar',
    async (q) => {
      productRepository.search.mockResolvedValue({ items: [], total: 0 });

      await sut.execute({ q, page: 1, pageSize: 20 });

      expect(productRepository.search).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'tenis nike' }),
      );
    },
  );

  it('envia o termo malicioso apenas normalizado, sem validar nem rejeitar', async () => {
    productRepository.search.mockResolvedValue({ items: [], total: 0 });

    const result = await sut.execute({
      q: "x'; DROP TABLE Product; --",
      page: 1,
      pageSize: 20,
    });

    expect(result.isSuccess).toBe(true);
    expect(productRepository.search).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'x; drop table product; --' }),
    );
  });
});
