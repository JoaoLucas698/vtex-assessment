import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { ProductNormalizerService } from '@modules/catalog-import/services/product-normalizer.service';
import { ProductRepository } from '@modules/products/repositories/product.repository';
import { ListProductsUseCase } from '@modules/products/usecases/list-products.usecase';

describe('ListProductsUseCase', () => {
  let sut: ListProductsUseCase;
  let productRepository: DeepMockProxy<ProductRepository>;
  let productNormalizer: DeepMockProxy<ProductNormalizerService>;

  beforeEach(() => {
    productRepository = mockDeep<ProductRepository>();
    productNormalizer = mockDeep<ProductNormalizerService>();
    productNormalizer.normalize.mockReturnValue('');
    sut = new ListProductsUseCase(productRepository, productNormalizer);
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

  it('normaliza o termo com o normalizer e envia o retorno ao repository', async () => {
    productNormalizer.normalize.mockReturnValue('tenis nike');
    productRepository.search.mockResolvedValue({ items: [], total: 0 });

    await sut.execute({ q: '  TÊNIS   Nike ', page: 1, pageSize: 20 });

    expect(productNormalizer.normalize).toHaveBeenCalledWith('  TÊNIS   Nike ');
    expect(productRepository.search).toHaveBeenCalledWith({
      q: 'tenis nike',
      page: 1,
      pageSize: 20,
    });
  });

  it('não rejeita termo malicioso: só repassa o retorno do normalizer', async () => {
    productNormalizer.normalize.mockReturnValue('x; drop table product; --');
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
