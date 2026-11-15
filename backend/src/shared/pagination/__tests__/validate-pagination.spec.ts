import { CommonErrorCode } from '@shared/errors/error-codes';
import { MAX_PAGE_SIZE } from '@shared/pagination/pagination.types';
import { validatePagination } from '@shared/pagination/validate-pagination';

describe('validatePagination', () => {
  it.each([
    { page: 1, pageSize: 1 },
    { page: 3, pageSize: 20 },
    { page: 1, pageSize: MAX_PAGE_SIZE },
  ])('aceita %j', (input) => {
    const result = validatePagination(input);

    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) expect(result.value).toEqual(input);
  });

  it('devolve o input inteiro, com campos extras', () => {
    const input = { sellerId: 7, page: 1, pageSize: 10 };

    const result = validatePagination(input);

    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) expect(result.value).toBe(input);
  });

  it.each([
    { page: 0, pageSize: 20 },
    { page: -1, pageSize: 20 },
    { page: 1.5, pageSize: 20 },
    { page: 1, pageSize: 0 },
    { page: 1, pageSize: 2.5 },
    { page: 1, pageSize: MAX_PAGE_SIZE + 1 },
    { page: Number.NaN, pageSize: 20 },
  ])('rejeita %j com VALIDATION_ERROR', (input) => {
    const result = validatePagination(input);

    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error.code).toBe(CommonErrorCode.VALIDATION_ERROR);
    }
  });
});
