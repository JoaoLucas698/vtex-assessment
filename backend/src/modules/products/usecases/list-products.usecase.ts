import { Injectable } from '@nestjs/common';
import { ProductRepository } from '@modules/products/repositories/product.repository';
import type {
  ListProductsInput,
  ListProductsOutput,
  ProductSearchResult,
} from '@modules/products/schemas/product.types';
import { ProductNormalizerService } from '@modules/catalog-import/services/product-normalizer.service';
import type { AppError } from '@shared/errors/app-error';
import { validatePagination } from '@shared/pagination/validate-pagination';
import { Result } from '@shared/result/result';

@Injectable()
export class ListProductsUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly productNormalizer: ProductNormalizerService,
  ) {}

  async execute(
    input: ListProductsInput,
  ): Promise<Result<ListProductsOutput, AppError>> {
    const validated = this.validatePagination(input);
    if (validated.isFailure) return validated;

    const query = this.normalizeQuery(input);
    if (query.isFailure) return query;

    const found = await this.searchProducts(query.value, input);
    if (found.isFailure) return found;

    return this.buildOutput(found.value, input);
  }

  /** Defesa para chamadas fora do HTTP: pela API o `ListProductsRequestDto` já garante estes limites. */
  private validatePagination(
    input: ListProductsInput,
  ): Result<ListProductsInput, AppError> {
    return validatePagination(input);
  }

  private normalizeQuery(input: ListProductsInput): Result<string, AppError> {
    return Result.success(this.productNormalizer.normalize(input.q));
  }

  private async searchProducts(
    q: string,
    input: ListProductsInput,
  ): Promise<Result<ProductSearchResult, AppError>> {
    const result = await this.productRepository.search({
      q,
      page: input.page,
      pageSize: input.pageSize,
    });
    return Result.success(result);
  }

  private buildOutput(
    found: ProductSearchResult,
    input: ListProductsInput,
  ): Result<ListProductsOutput, AppError> {
    return Result.success({
      items: found.items,
      total: found.total,
      page: input.page,
      pageSize: input.pageSize,
    });
  }
}
