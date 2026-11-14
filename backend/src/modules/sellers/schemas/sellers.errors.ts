import { HttpStatus } from '@nestjs/common';
import type { AppError } from '@shared/errors/app-error';
import { registerErrorStatuses } from '@shared/errors/error-http-status';
import { CommonErrorCode } from '@shared/errors/error-codes';

export enum SellerErrorCode {
  SELLER_NOT_FOUND = 'SELLER_NOT_FOUND',
}

registerErrorStatuses({
  [SellerErrorCode.SELLER_NOT_FOUND]: HttpStatus.NOT_FOUND,
});

export const SellerErrors = {
  notFound: (sellerId: number): AppError => ({
    code: SellerErrorCode.SELLER_NOT_FOUND,
    message: `Seller ${sellerId} não encontrado.`,
  }),
  invalidPagination: (): AppError => ({
    code: CommonErrorCode.VALIDATION_ERROR,
    message:
      'Paginação inválida: page e pageSize devem ser inteiros positivos.',
  }),
};
