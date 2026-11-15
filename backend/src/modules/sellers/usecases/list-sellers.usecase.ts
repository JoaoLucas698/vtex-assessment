import { Injectable } from '@nestjs/common';
import { SellerRepository } from '@modules/sellers/repositories/seller.repository';
import type {
  ListSellersInput,
  ListSellersOutput,
} from '@modules/sellers/schemas/seller.types';
import type { AppError } from '@shared/errors/app-error';
import { validatePagination } from '@shared/pagination/validate-pagination';
import { Result } from '@shared/result/result';

@Injectable()
export class ListSellersUseCase {
  constructor(private readonly sellerRepository: SellerRepository) {}

  async execute(
    input: ListSellersInput,
  ): Promise<Result<ListSellersOutput, AppError>> {
    const validated = this.validatePagination(input);
    if (validated.isFailure) return validated;

    return this.listSellers(validated.value);
  }

  /** Defesa para chamadas fora do HTTP: pela API o `PaginationRequestDto` já garante estes limites. */
  private validatePagination(
    input: ListSellersInput,
  ): Result<ListSellersInput, AppError> {
    return validatePagination(input);
  }

  private async listSellers(
    input: ListSellersInput,
  ): Promise<Result<ListSellersOutput, AppError>> {
    const { items, total } = await this.sellerRepository.list(input);
    return Result.success({
      items: items.map((seller) => ({
        id: seller.id,
        sellerName: seller.sellerName,
        productCount: seller.productCount,
      })),
      total,
      page: input.page,
      pageSize: input.pageSize,
    });
  }
}
