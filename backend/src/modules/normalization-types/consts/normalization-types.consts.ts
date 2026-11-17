import { NormalizationTypeCode } from '@modules/normalization-types/schemas/normalization-type.types';

/**
 * Ids fixos dos tipos de normalização, inseridos pela migration `add_normalization_types`
 * (D-110). Os ids são parte do contrato do banco: a migration grava exatamente estes valores.
 */
export const NORMALIZATION_TYPE_IDS = {
  [NormalizationTypeCode.NAME_BRAND]: 1,
  [NormalizationTypeCode.NAME_CATEGORY]: 2,
  [NormalizationTypeCode.NAME_BRAND_CATEGORY]: 3,
} as const satisfies Record<NormalizationTypeCode, number>;

/**
 * Tipo dos produtos legados e, até a importação aceitar o tipo como parâmetro, de toda
 * importação (D-111): `marca|nome`, a mesma regra que gerou as chaves existentes.
 */
export const LEGACY_NORMALIZATION_TYPE_ID =
  NORMALIZATION_TYPE_IDS[NormalizationTypeCode.NAME_BRAND];
