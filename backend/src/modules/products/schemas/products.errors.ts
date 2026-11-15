import { HttpStatus } from '@nestjs/common';
import type { AppError } from '@shared/errors/app-error';
import { registerErrorStatuses } from '@shared/errors/error-http-status';

export enum ProductsErrorCode {
  PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',
}

registerErrorStatuses({
  [ProductsErrorCode.PRODUCT_NOT_FOUND]: HttpStatus.NOT_FOUND,
});

export const ProductsErrors = {
  productNotFound: (id: number): AppError => ({
    code: ProductsErrorCode.PRODUCT_NOT_FOUND,
    message: `Produto ${id} não encontrado.`,
  }),
};
