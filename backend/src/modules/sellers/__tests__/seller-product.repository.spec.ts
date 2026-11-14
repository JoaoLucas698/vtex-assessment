import type { Prisma } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { SellerProductRepository } from '@modules/sellers/repositories/seller-product.repository';
import { PrismaService } from '@shared/prisma/prisma.service';

describe('SellerProductRepository', () => {
  let sut: SellerProductRepository;
  let prisma: DeepMockProxy<PrismaService>;
  let tx: DeepMockProxy<Prisma.TransactionClient>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    tx = mockDeep<Prisma.TransactionClient>();
    sut = new SellerProductRepository(prisma);
  });

  it('findBySellerAndExternalId usa o tx quando passado', async () => {
    await sut.findBySellerAndExternalId(1, 'A1', tx);

    expect(tx.sellerProduct.findUnique).toHaveBeenCalledWith({
      where: { sellerId_externalId: { sellerId: 1, externalId: 'A1' } },
    });
    expect(prisma.sellerProduct.findUnique).not.toHaveBeenCalled();
  });

  it('findBySellerAndProduct usa o tx quando passado', async () => {
    await sut.findBySellerAndProduct(1, 2, tx);

    expect(tx.sellerProduct.findUnique).toHaveBeenCalledWith({
      where: { productId_sellerId: { productId: 2, sellerId: 1 } },
    });
    expect(prisma.sellerProduct.findUnique).not.toHaveBeenCalled();
  });

  it('create usa o tx quando passado', async () => {
    const data = {
      productId: 2,
      sellerId: 1,
      externalId: 'A1',
      name: 'Produto',
      brand: null,
      category: null,
      matchedBy: 'new',
    };

    await sut.create(data, tx);

    expect(tx.sellerProduct.create).toHaveBeenCalledWith({ data });
    expect(prisma.sellerProduct.create).not.toHaveBeenCalled();
  });

  it('updateSellerData atualiza só os dados do seller, usando o tx', async () => {
    await sut.updateSellerData(
      5,
      { name: 'Novo', brand: null, category: 'Cat' },
      tx,
    );

    expect(tx.sellerProduct.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { name: 'Novo', brand: null, category: 'Cat' },
    });
    expect(prisma.sellerProduct.update).not.toHaveBeenCalled();
  });

  it('listBySeller usa o PrismaService sem tx e pagina', async () => {
    prisma.sellerProduct.findMany.mockResolvedValue([]);
    prisma.sellerProduct.count.mockResolvedValue(0);

    const result = await sut.listBySeller(1, { page: 3, pageSize: 10 });

    expect(prisma.sellerProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sellerId: 1 },
        skip: 20,
        take: 10,
      }),
    );
    expect(result).toEqual({ items: [], total: 0 });
  });

  it('listBySeller usa o tx quando passado', async () => {
    tx.sellerProduct.findMany.mockResolvedValue([]);
    tx.sellerProduct.count.mockResolvedValue(0);

    await sut.listBySeller(1, { page: 1, pageSize: 10 }, tx);

    expect(tx.sellerProduct.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.sellerProduct.findMany).not.toHaveBeenCalled();
  });
});
