import type { Prisma } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { NormalizationTypeRepository } from '@modules/normalization-types/repositories/normalization-type.repository';
import { PrismaService } from '@shared/prisma/prisma.service';

describe('NormalizationTypeRepository', () => {
  let sut: NormalizationTypeRepository;
  let prisma: DeepMockProxy<PrismaService>;
  let tx: DeepMockProxy<Prisma.TransactionClient>;

  const record = {
    id: 1,
    code: 'NAME_BRAND',
    description: 'Nome + Marca',
    includesBrand: true,
    includesCategory: false,
  };

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    tx = mockDeep<Prisma.TransactionClient>();
    sut = new NormalizationTypeRepository(prisma);
  });

  it('findAll ordena por id e seleciona só os campos do record', async () => {
    prisma.normalizationType.findMany.mockResolvedValue([record] as never);

    const found = await sut.findAll();

    expect(found).toEqual([record]);
    expect(prisma.normalizationType.findMany).toHaveBeenCalledWith({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        code: true,
        description: true,
        includesBrand: true,
        includesCategory: true,
      },
    });
  });

  it('findAll usa o tx quando informado', async () => {
    tx.normalizationType.findMany.mockResolvedValue([] as never);

    await sut.findAll(tx);

    expect(tx.normalizationType.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.normalizationType.findMany).not.toHaveBeenCalled();
  });

  it('findByCode busca pelo code único e usa o tx quando informado', async () => {
    tx.normalizationType.findUnique.mockResolvedValue(record as never);

    const found = await sut.findByCode('NAME_BRAND', tx);

    expect(found).toEqual(record);
    expect(tx.normalizationType.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: 'NAME_BRAND' } }),
    );
    expect(prisma.normalizationType.findUnique).not.toHaveBeenCalled();
  });

  it('findByCode devolve null quando o code não existe', async () => {
    prisma.normalizationType.findUnique.mockResolvedValue(null);

    expect(await sut.findByCode('NOPE')).toBeNull();
  });
});
