import { Injectable } from '@nestjs/common';
import { ProductRepository } from '@modules/products/repositories/product.repository';
import { ProductsErrors } from '@modules/products/schemas/products.errors';
import type { ProductWithSellers } from '@modules/products/schemas/product.types';
import { fillFromOfficialProduct } from '@shared/catalog/fill-from-official-product';
import type { AppError } from '@shared/errors/app-error';
import { Result } from '@shared/result/result';

@Injectable()
export class GetProductDetailUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(id: number): Promise<Result<ProductWithSellers, AppError>> {
    const product = await this.findProduct(id);
    if (product.isFailure) return product;

    return this.fillMissingSellerData(product.value);
  }

  private async findProduct(
    id: number,
  ): Promise<Result<ProductWithSellers, AppError>> {
    const product = await this.productRepository.findByIdWithSellers(id);
    if (!product) return Result.error(ProductsErrors.productNotFound(id));
    return Result.success(product);
  }

  /** D-014: `brand`/`category` que o seller não informou vêm do produto oficial (regra compartilhada, D-061). */
  private fillMissingSellerData(
    product: ProductWithSellers,
  ): Result<ProductWithSellers, AppError> {
    return Result.success({
      ...product,
      sellers: product.sellers.map((seller) =>
        fillFromOfficialProduct(seller, product),
      ),
    });
  }
}
