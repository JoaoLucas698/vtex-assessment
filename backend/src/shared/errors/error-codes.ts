/** Códigos genéricos, reutilizáveis por qualquer módulo. Cada módulo define os seus em `schemas/<modulo>.errors.ts`. */
export enum CommonErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
