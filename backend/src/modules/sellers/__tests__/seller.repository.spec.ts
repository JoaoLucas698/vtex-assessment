import type { Prisma } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { SellerRepository } from '@modules/sellers/repositories/seller.repository';
import { PrismaService } from '@shared/prisma/prisma.service';

describe('SellerRepository', () => {
  let sut: SellerRepository;
  let prisma: DeepMockProxy<PrismaService>;
  let tx: DeepMockProxy<Prisma.TransactionClient>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    tx = mockDeep<Prisma.TransactionClient>();
    sut = new SellerRepository(prisma);
  });

  it('findByName usa o tx quando passado', async () => {
    await sut.findByName('Loja A', tx);

    expect(tx.seller.findUnique).toHaveBeenCalledWith({
      where: { sellerName: 'Loja A' },
    });
    expect(prisma.seller.findUnique).not.toHaveBeenCalled();
  });

  it('findByName usa o PrismaService sem tx', async () => {
    await sut.findByName('Loja A');

    expect(prisma.seller.findUnique).toHaveBeenCalledTimes(1);
  });

  it('create usa o tx quando passado', async () => {
    await sut.create('Loja A', tx);

    expect(tx.seller.create).toHaveBeenCalledWith({
      data: { sellerName: 'Loja A' },
    });
    expect(prisma.seller.create).not.toHaveBeenCalled();
  });

  it('findById usa o tx quando passado', async () => {
    await sut.findById(1, tx);

    expect(tx.seller.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(prisma.seller.findUnique).not.toHaveBeenCalled();
  });

  it('list pagina, conta e mapeia a contagem de produtos', async () => {
    const now = new Date();
    tx.seller.findMany.mockResolvedValue([
      {
        id: 1,
        sellerName: 'Loja A',
        createdAt: now,
        updatedAt: now,
        _count: { sellerProducts: 4 },
      },
    ] as never);
    tx.seller.count.mockResolvedValue(9);

    const result = await sut.list({ page: 2, pageSize: 5 }, tx);

    expect(tx.seller.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
    expect(result.total).toBe(9);
    expect(result.items[0].productCount).toBe(4);
    expect(prisma.seller.findMany).not.toHaveBeenCalled();
  });
});
