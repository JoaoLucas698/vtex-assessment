import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { NormalizationTypeRepository } from '@modules/normalization-types/repositories/normalization-type.repository';
import {
  NormalizationTypeCode,
  type NormalizationTypeRecord,
} from '@modules/normalization-types/schemas/normalization-type.types';
import { ListNormalizationTypesUseCase } from '@modules/normalization-types/usecases/list-normalization-types.usecase';

describe('ListNormalizationTypesUseCase', () => {
  let sut: ListNormalizationTypesUseCase;
  let normalizationTypeRepository: DeepMockProxy<NormalizationTypeRepository>;

  const types: NormalizationTypeRecord[] = [
    {
      id: 1,
      code: NormalizationTypeCode.NAME_BRAND,
      description: 'Nome + Marca',
      includesBrand: true,
      includesCategory: false,
    },
    {
      id: 3,
      code: NormalizationTypeCode.NAME_BRAND_CATEGORY,
      description: 'Nome + Marca + Categoria',
      includesBrand: true,
      includesCategory: true,
    },
  ];

  beforeEach(() => {
    normalizationTypeRepository = mockDeep<NormalizationTypeRepository>();
    sut = new ListNormalizationTypesUseCase(normalizationTypeRepository);
  });

  it('lista os tipos na ordem devolvida pelo repository', async () => {
    normalizationTypeRepository.findAll.mockResolvedValue(types);

    const result = await sut.execute();

    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.value).toEqual({
        items: [
          {
            id: 1,
            code: 'NAME_BRAND',
            description: 'Nome + Marca',
            includesBrand: true,
            includesCategory: false,
          },
          {
            id: 3,
            code: 'NAME_BRAND_CATEGORY',
            description: 'Nome + Marca + Categoria',
            includesBrand: true,
            includesCategory: true,
          },
        ],
      });
    }
    expect(normalizationTypeRepository.findAll).toHaveBeenCalledTimes(1);
  });

  it('devolve lista vazia quando não há tipos cadastrados', async () => {
    normalizationTypeRepository.findAll.mockResolvedValue([]);

    const result = await sut.execute();

    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) expect(result.value.items).toEqual([]);
  });

  it('não expõe campos extras vindos do repository', async () => {
    normalizationTypeRepository.findAll.mockResolvedValue([
      { ...types[0], createdAt: new Date() } as NormalizationTypeRecord,
    ]);

    const result = await sut.execute();

    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(Object.keys(result.value.items[0]).sort()).toEqual([
        'code',
        'description',
        'id',
        'includesBrand',
        'includesCategory',
      ]);
    }
  });
});
