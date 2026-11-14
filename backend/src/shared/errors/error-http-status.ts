import { HttpStatus } from '@nestjs/common';
import { CommonErrorCode } from '@shared/errors/error-codes';

/**
 * Único lugar do mapeamento `code -> status HTTP`.
 * Cada módulo registra os seus códigos com `registerErrorStatuses` (ex.: no topo do arquivo do módulo).
 */
const errorStatusByCode = new Map<string, HttpStatus>([
  [CommonErrorCode.VALIDATION_ERROR, HttpStatus.BAD_REQUEST],
  [CommonErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND],
  [CommonErrorCode.CONFLICT, HttpStatus.CONFLICT],
  [CommonErrorCode.INTERNAL_ERROR, HttpStatus.INTERNAL_SERVER_ERROR],
]);

export function registerErrorStatuses(
  statuses: Readonly<Record<string, HttpStatus>>,
): void {
  for (const [code, status] of Object.entries(statuses)) {
    errorStatusByCode.set(code, status);
  }
}

/** Código sem mapeamento vira 500: é um bug de configuração, não um erro esperado. */
export function getHttpStatusForCode(code: string): HttpStatus {
  return errorStatusByCode.get(code) ?? HttpStatus.INTERNAL_SERVER_ERROR;
}
