/** Exemplos do Swagger do módulo `sellers`, tipados pelo corpo de erro real (D-038). */
import { HttpStatus } from '@nestjs/common';
import { SellerErrorCode } from '@modules/sellers/schemas/sellers.errors';
import { CommonErrorCode } from '@shared/errors/error-codes';
import type { ErrorResponseBody } from '@shared/errors/error-response.types';

/** 400 de `GET /api/sellers`: paginação inválida (`ValidationPipe`). */
export const LIST_SELLERS_BAD_REQUEST_EXAMPLE = {
  statusCode: HttpStatus.BAD_REQUEST,
  code: CommonErrorCode.VALIDATION_ERROR,
  message: 'Requisição inválida',
  details: ['pageSize must not be greater than 100'],
} satisfies ErrorResponseBody;

/** 400 de `GET /api/sellers/:id/products`: id não numérico (`ParseIntPipe`). */
export const LIST_SELLER_PRODUCTS_BAD_REQUEST_EXAMPLE = {
  statusCode: HttpStatus.BAD_REQUEST,
  code: CommonErrorCode.VALIDATION_ERROR,
  message: 'Validation failed (numeric string is expected)',
} satisfies ErrorResponseBody;

/** 404 de `GET /api/sellers/:id/products`. */
export const SELLER_NOT_FOUND_EXAMPLE = {
  statusCode: HttpStatus.NOT_FOUND,
  code: SellerErrorCode.SELLER_NOT_FOUND,
  message: 'Seller 999 não encontrado.',
} satisfies ErrorResponseBody;
