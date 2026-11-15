import { Injectable } from '@nestjs/common';
import { SellerProductRepository } from '@modules/sellers/repositories/seller-product.repository';
import { SellerRepository } from '@modules/sellers/repositories/seller.repository';
import { SellerProductViewService } from '@modules/sellers/services/seller-product-view.service';
import type {
  ListSellerProductsInput,
  ListSellerProductsOutput,
} from '@modules/sellers/schemas/seller.types';
import { SellerErrors } from '@modules/sellers/schemas/sellers.errors';
import type { AppError } from '@shared/errors/app-error';
import { validatePagination } from '@shared/pagination/validate-pagination';
import { Result } from '@shared/result/result';
import type { Seller } from '@prisma/client';

@Injectable()
export class ListSellerProductsUseCase {
  constructor(
    private readonly sellerRepository: SellerRepository,
    private readonly sellerProductRepository: SellerProductRepository,
    private readonly sellerProductViewService: SellerProductViewService,
  ) {}

  async execute(
    input: ListSellerProductsInput,
  ): Promise<Result<ListSellerProductsOutput, AppError>> {
    const validated = this.validatePagination(input);
    if (validated.isFailure) return validated;

    const seller = await this.findSeller(input.sellerId);
    if (seller.isFailure) return seller;

    return this.listProducts(seller.value, input);
  }

  /** Defesa para chamadas fora do HTTP: pela API o `PaginationRequestDto` já garante estes limites. */
  private validatePagination(
    input: ListSellerProductsInput,
  ): Result<ListSellerProductsInput, AppError> {
    return validatePagination(input);
  }

  private async findSeller(
    sellerId: number,
  ): Promise<Result<Seller, AppError>> {
    const seller = await this.sellerRepository.findById(sellerId);
    if (!seller) return Result.error(SellerErrors.notFound(sellerId));
    return Result.success(seller);
  }

  private async listProducts(
    seller: Seller,
    input: ListSellerProductsInput,
  ): Promise<Result<ListSellerProductsOutput, AppError>> {
    const { items, total } = await this.sellerProductRepository.listBySeller(
      seller.id,
      { page: input.page, pageSize: input.pageSize },
    );
    return Result.success({
      seller: { id: seller.id, sellerName: seller.sellerName },
      items: items.map((link) => this.sellerProductViewService.toOutput(link)),
      total,
      page: input.page,
      pageSize: input.pageSize,
    });
  }
}
