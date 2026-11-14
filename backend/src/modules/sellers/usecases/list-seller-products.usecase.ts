import { Injectable } from '@nestjs/common';
import { SellerProductRepository } from '@modules/sellers/repositories/seller-product.repository';
import { SellerRepository } from '@modules/sellers/repositories/seller.repository';
import type {
  ListSellerProductsInput,
  ListSellerProductsOutput,
} from '@modules/sellers/schemas/seller.types';
import { SellerErrors } from '@modules/sellers/schemas/sellers.errors';
import type { AppError } from '@shared/errors/app-error';
import { Result } from '@shared/result/result';
import type { Seller } from '@prisma/client';

@Injectable()
export class ListSellerProductsUseCase {
  constructor(
    private readonly sellerRepository: SellerRepository,
    private readonly sellerProductRepository: SellerProductRepository,
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

  private validatePagination(
    input: ListSellerProductsInput,
  ): Result<ListSellerProductsInput, AppError> {
    const valid =
      Number.isInteger(input.page) &&
      input.page >= 1 &&
      Number.isInteger(input.pageSize) &&
      input.pageSize >= 1;
    if (!valid) return Result.error(SellerErrors.invalidPagination());
    return Result.success(input);
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
      items: items.map((link) => ({
        id: link.id,
        externalId: link.externalId,
        name: link.name,
        brand: link.brand,
        category: link.category,
        matchedBy: link.matchedBy,
        product: { id: link.product.id, name: link.product.name },
      })),
      total,
      page: input.page,
      pageSize: input.pageSize,
    });
  }
}
