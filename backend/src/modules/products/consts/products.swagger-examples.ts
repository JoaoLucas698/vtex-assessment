/** Exemplos do Swagger do módulo `products`, tipados pelo corpo de erro real (D-038). */
import { HttpStatus } from '@nestjs/common';
import { ProductsErrorCode } from '@modules/products/schemas/products.errors';
import { CommonErrorCode } from '@shared/errors/error-codes';
import type { ErrorResponseBody } from '@shared/errors/error-response.types';

/** 400 de `GET /api/products`: query inválida (`ValidationPipe`). */
export const LIST_PRODUCTS_BAD_REQUEST_EXAMPLE = {
  statusCode: HttpStatus.BAD_REQUEST,
  code: CommonErrorCode.VALIDATION_ERROR,
  message: 'Requisição inválida',
  details: ['pageSize must not be greater than 100'],
} satisfies ErrorResponseBody;

/** 400 de `GET /api/products/:id`: id não numérico (`ParseIntPipe`). */
export const PRODUCT_DETAIL_BAD_REQUEST_EXAMPLE = {
  statusCode: HttpStatus.BAD_REQUEST,
  code: CommonErrorCode.VALIDATION_ERROR,
  message: 'Validation failed (numeric string is expected)',
} satisfies ErrorResponseBody;

/** 404 de `GET /api/products/:id`. */
export const PRODUCT_NOT_FOUND_EXAMPLE = {
  statusCode: HttpStatus.NOT_FOUND,
  code: ProductsErrorCode.PRODUCT_NOT_FOUND,
  message: 'Produto 999 não encontrado.',
} satisfies ErrorResponseBody;
