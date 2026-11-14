import { HttpException, HttpStatus } from '@nestjs/common';
import { CommonErrorCode } from '@shared/errors/error-codes';
import { registerErrorStatuses } from '@shared/errors/error-http-status';
import { unwrapResult } from '@shared/errors/unwrap-result';
import { Result } from '@shared/result/result';

function catchHttpException(fn: () => unknown): HttpException {
  try {
    fn();
  } catch (error) {
    return error as HttpException;
  }
  throw new Error('esperava uma HttpException');
}

describe('unwrapResult', () => {
  it('devolve o valor quando o resultado é sucesso', () => {
    expect(unwrapResult(Result.success({ id: 1 }))).toEqual({ id: 1 });
  });

  it('lança HttpException com o status mapeado para o code', () => {
    const exception = catchHttpException(() =>
      unwrapResult(
        Result.error({
          code: CommonErrorCode.NOT_FOUND,
          message: 'Produto não encontrado',
        }),
      ),
    );

    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(exception.getResponse()).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Produto não encontrado',
    });
  });

  it('inclui details quando informado', () => {
    const exception = catchHttpException(() =>
      unwrapResult(
        Result.error({
          code: CommonErrorCode.VALIDATION_ERROR,
          message: 'Inválido',
          details: ['campo'],
        }),
      ),
    );

    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(exception.getResponse()).toMatchObject({ details: ['campo'] });
  });

  it('usa o mapeamento registrado por um módulo', () => {
    registerErrorStatuses({ SELLER_TESTE: HttpStatus.UNPROCESSABLE_ENTITY });

    const exception = catchHttpException(() =>
      unwrapResult(Result.error({ code: 'SELLER_TESTE', message: 'x' })),
    );

    expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
  });

  it('code sem mapeamento vira 500', () => {
    const exception = catchHttpException(() =>
      unwrapResult(Result.error({ code: 'DESCONHECIDO', message: 'x' })),
    );

    expect(exception.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
