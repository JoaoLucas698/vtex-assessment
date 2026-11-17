/** Exemplos do Swagger do módulo `normalization-types`, tipados pelo contrato real (D-038). */
import { NORMALIZATION_TYPE_IDS } from '@modules/normalization-types/consts/normalization-types.consts';
import {
  NormalizationTypeCode,
  type ListNormalizationTypesOutput,
} from '@modules/normalization-types/schemas/normalization-type.types';

/** 200 de `GET /api/normalization-types`: os 3 tipos cadastrados pela migration. */
export const LIST_NORMALIZATION_TYPES_OK_EXAMPLE = {
  items: [
    {
      id: NORMALIZATION_TYPE_IDS[NormalizationTypeCode.NAME_BRAND],
      code: NormalizationTypeCode.NAME_BRAND,
      description: 'Nome + Marca',
      includesBrand: true,
      includesCategory: false,
    },
    {
      id: NORMALIZATION_TYPE_IDS[NormalizationTypeCode.NAME_CATEGORY],
      code: NormalizationTypeCode.NAME_CATEGORY,
      description: 'Nome + Categoria',
      includesBrand: false,
      includesCategory: true,
    },
    {
      id: NORMALIZATION_TYPE_IDS[NormalizationTypeCode.NAME_BRAND_CATEGORY],
      code: NormalizationTypeCode.NAME_BRAND_CATEGORY,
      description: 'Nome + Marca + Categoria',
      includesBrand: true,
      includesCategory: true,
    },
  ],
} satisfies ListNormalizationTypesOutput;
