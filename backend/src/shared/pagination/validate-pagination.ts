import type { AppError } from '@shared/errors/app-error';
import { CommonErrorCode } from '@shared/errors/error-codes';
import {
  MAX_PAGE_SIZE,
  type PaginationParams,
} from '@shared/pagination/pagination.types';
import { Result } from '@shared/result/result';

export const PaginationErrors = {
  invalid: (): AppError => ({
    code: CommonErrorCode.VALIDATION_ERROR,
    message: `Paginação inválida: page e pageSize devem ser inteiros positivos, com pageSize até ${MAX_PAGE_SIZE}.`,
  }),
};

/**
 * Confere `page >= 1` e `1 <= pageSize <= MAX_PAGE_SIZE`, todos inteiros.
 * Pela API o `PaginationRequestDto` já garante isso; esta função é a defesa
 * para chamadas fora do HTTP. Devolve o próprio input no sucesso.
 */
export function validatePagination<T extends PaginationParams>(
  input: T,
): Result<T, AppError> {
  const valid =
    Number.isInteger(input.page) &&
    input.page >= 1 &&
    Number.isInteger(input.pageSize) &&
    input.pageSize >= 1 &&
    input.pageSize <= MAX_PAGE_SIZE;
  if (!valid) return Result.error(PaginationErrors.invalid());
  return Result.success(input);
}
