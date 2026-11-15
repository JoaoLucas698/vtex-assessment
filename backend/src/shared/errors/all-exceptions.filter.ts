import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { CommonErrorCode } from '@shared/errors/error-codes';
import type { ErrorResponseBody } from '@shared/errors/error-response.types';

type ErrorBody = ErrorResponseBody;

/** Filtro global: `HttpException` mantém o status; qualquer outro erro vira 500 sem vazar stack. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body =
      exception instanceof HttpException
        ? this.fromHttpException(exception)
        : this.fromUnexpected(exception);
    response.status(body.statusCode).json(body);
  }

  private fromHttpException(exception: HttpException): ErrorBody {
    const statusCode = exception.getStatus();
    const payload = exception.getResponse();
    if (typeof payload === 'string') {
      return {
        statusCode,
        code: this.defaultCode(statusCode),
        message: payload,
      };
    }
    const { code, message, details } = payload as {
      code?: string;
      message?: string | string[];
      details?: unknown;
    };
    if (Array.isArray(message)) {
      // Erros do ValidationPipe chegam como lista de mensagens.
      return {
        statusCode,
        code: code ?? CommonErrorCode.VALIDATION_ERROR,
        message: 'Requisição inválida',
        details: message,
      };
    }
    return {
      statusCode,
      code: code ?? this.defaultCode(statusCode),
      message: message ?? exception.message,
      details,
    };
  }

  private fromUnexpected(exception: unknown): ErrorBody {
    // Erros do body-parser (corpo grande demais) chegam como objetos com `status`, não como HttpException.
    if (
      typeof exception === 'object' &&
      exception !== null &&
      'status' in exception &&
      exception.status === HttpStatus.PAYLOAD_TOO_LARGE
    ) {
      return {
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        code: CommonErrorCode.PAYLOAD_TOO_LARGE,
        message: 'Arquivo ou corpo da requisição grande demais',
      };
    }
    this.logger.error(
      exception instanceof Error
        ? (exception.stack ?? exception.message)
        : String(exception),
    );
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: CommonErrorCode.INTERNAL_ERROR,
      message: 'Erro interno do servidor',
    };
  }

  private defaultCode(statusCode: number): string {
    const codes: Record<number, CommonErrorCode> = {
      [HttpStatus.BAD_REQUEST]: CommonErrorCode.VALIDATION_ERROR,
      [HttpStatus.NOT_FOUND]: CommonErrorCode.NOT_FOUND,
      [HttpStatus.CONFLICT]: CommonErrorCode.CONFLICT,
      [HttpStatus.PAYLOAD_TOO_LARGE]: CommonErrorCode.PAYLOAD_TOO_LARGE,
    };
    return codes[statusCode] ?? CommonErrorCode.INTERNAL_ERROR;
  }
}
