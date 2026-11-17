import { Prisma } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { ProductRepository } from '@modules/products/repositories/product.repository';
import { PrismaService } from '@shared/prisma/prisma.service';

describe('ProductRepository', () => {
  let sut: ProductRepository;
  let prisma: DeepMockProxy<PrismaService>;
  let tx: DeepMockProxy<Prisma.TransactionClient>;

  const record = {
    id: 1,
    name: 'Camisa',
    brand: 'Nike',
    category: null,
    normalizationTypeId: 1,
    normalizedKey: 'nike|camisa',
  };

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    tx = mockDeep<Prisma.TransactionClient>();
    sut = new ProductRepository(prisma);
  });

  it('findByTypeAndKey busca pelo único composto (tipo, chave) e usa o tx quando informado', async () => {
    tx.product.findUnique.mockResolvedValue(record as never);

    const found = await sut.findByTypeAndKey(1, 'nike|camisa', tx);

    expect(found).toEqual(record);
    expect(tx.product.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          normalizationTypeId_normalizedKey: {
            normalizationTypeId: 1,
            normalizedKey: 'nike|camisa',
          },
        },
      }),
    );
    expect(prisma.product.findUnique).not.toHaveBeenCalled();
  });

  it('findByTypeAndKey usa o PrismaService sem tx e devolve null', async () => {
    prisma.product.findUnique.mockResolvedValue(null);

    const found = await sut.findByTypeAndKey(2, 'x|y');

    expect(found).toBeNull();
    expect(prisma.product.findUnique).toHaveBeenCalledTimes(1);
  });

  it('create usa o tx quando informado', async () => {
    tx.product.create.mockResolvedValue(record as never);

    await sut.create(
      {
        name: 'Camisa',
        brand: 'Nike',
        category: null,
        normalizationTypeId: 1,
        normalizedKey: 'nike|camisa',
      },
      tx,
    );

    expect(tx.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ normalizationTypeId: 1 }) as unknown,
      }),
    );
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('search filtra por normalizedKey, pagina e ordena por id', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 3,
        name: 'A',
        brand: null,
        category: null,
        _count: { sellerProducts: 2 },
      },
    ] as never);
    prisma.product.count.mockResolvedValue(11);

    const result = await sut.search({ q: 'nike', page: 3, pageSize: 5 });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { normalizedKey: { contains: 'nike' } },
        orderBy: { id: 'asc' },
        skip: 10,
        take: 5,
      }),
    );
    expect(result).toEqual({
      items: [
        { id: 3, name: 'A', brand: null, category: null, sellersCount: 2 },
      ],
      total: 11,
    });
  });

  it('search sem termo não filtra', async () => {
    prisma.product.findMany.mockResolvedValue([] as never);
    prisma.product.count.mockResolvedValue(0);

    await sut.search({ q: '', page: 1, pageSize: 20 });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('findByIdWithSellers devolve null quando não existe', async () => {
    prisma.product.findUnique.mockResolvedValue(null);

    expect(await sut.findByIdWithSellers(9)).toBeNull();
  });
});
