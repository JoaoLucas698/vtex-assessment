/** Tipos de domínio do módulo `normalization-types` (derivados dos tipos gerados pelo Prisma). */
import type { NormalizationType } from '@prisma/client';

/**
 * Códigos dos tipos de normalização da chave do produto (D-110). O nome sempre entra na
 * chave; marca e categoria entram conforme as flags do tipo.
 */
export enum NormalizationTypeCode {
  NAME_BRAND = 'NAME_BRAND',
  NAME_CATEGORY = 'NAME_CATEGORY',
  NAME_BRAND_CATEGORY = 'NAME_BRAND_CATEGORY',
}

/** Tipo de normalização como o módulo o expõe (sem as datas de auditoria). */
export type NormalizationTypeRecord = Pick<
  NormalizationType,
  'id' | 'code' | 'description' | 'includesBrand' | 'includesCategory'
>;

export interface NormalizationTypeOutput {
  readonly id: number;
  readonly code: string;
  readonly description: string;
  readonly includesBrand: boolean;
  readonly includesCategory: boolean;
}

export interface ListNormalizationTypesOutput {
  readonly items: NormalizationTypeOutput[];
}
