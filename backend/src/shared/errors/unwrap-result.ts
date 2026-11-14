import { HttpException } from '@nestjs/common';
import type { AppError } from '@shared/errors/app-error';
import { getHttpStatusForCode } from '@shared/errors/error-http-status';
import type { Result } from '@shared/result/result';

/** Devolve o valor do sucesso ou lança a `HttpException` correspondente ao `code` do erro. */
export function unwrapResult<T>(result: Result<T, AppError>): T {
  if (result.isFailure) {
    const { code, message, details } = result.error;
    const status = getHttpStatusForCode(code);
    throw new HttpException(
      { statusCode: status, code, message, details },
      status,
    );
  }
  return result.value;
}
