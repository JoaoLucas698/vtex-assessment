import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Response } from 'express';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { AllExceptionsFilter } from '@shared/errors/all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let sut: AllExceptionsFilter;
  let response: DeepMockProxy<Response>;
  let host: DeepMockProxy<ArgumentsHost>;

  beforeEach(() => {
    sut = new AllExceptionsFilter();
    response = mockDeep<Response>();
    response.status.mockReturnValue(response);
    host = mockDeep<ArgumentsHost>();
    host.switchToHttp.mockReturnValue({
      getResponse: () => response,
    } as ReturnType<ArgumentsHost['switchToHttp']>);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('erro inesperado vira 500 sem vazar a mensagem nem a stack', () => {
    sut.catch(new Error('senha do banco: 123'), host);

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Erro interno do servidor',
    });
  });

  it('mantém status e code de uma HttpException vinda do unwrapResult', () => {
    const exception = new HttpException(
      { statusCode: 404, code: 'NOT_FOUND', message: 'Não achou' },
      404,
    );

    sut.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Não achou',
      details: undefined,
    });
  });

  it('erros do ValidationPipe viram VALIDATION_ERROR com details', () => {
    sut.catch(new BadRequestException(['name must be a string']), host);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Requisição inválida',
      details: ['name must be a string'],
    });
  });

  it('413 vira PAYLOAD_TOO_LARGE, vindo de HttpException', () => {
    sut.catch(new PayloadTooLargeException(), host);

    expect(response.status).toHaveBeenCalledWith(413);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 413, code: 'PAYLOAD_TOO_LARGE' }),
    );
  });

  it('413 do body-parser (objeto com status) vira PAYLOAD_TOO_LARGE e não 500', () => {
    sut.catch({ status: 413, message: 'request entity too large' }, host);

    expect(response.status).toHaveBeenCalledWith(413);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 413, code: 'PAYLOAD_TOO_LARGE' }),
    );
  });
});
