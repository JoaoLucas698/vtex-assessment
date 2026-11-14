import { Injectable } from '@nestjs/common';
import { ProductRepository } from '@modules/products/repositories/product.repository';
import { ProductsErrors } from '@modules/products/schemas/products.errors';
import type { ProductWithSellers } from '@modules/products/schemas/product.types';
import type { AppError } from '@shared/errors/app-error';
import { Result } from '@shared/result/result';

@Injectable()
export class GetProductDetailUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(id: number): Promise<Result<ProductWithSellers, AppError>> {
    return this.findProduct(id);
  }

  private async findProduct(
    id: number,
  ): Promise<Result<ProductWithSellers, AppError>> {
    const product = await this.productRepository.findByIdWithSellers(id);
    if (!product) return Result.error(ProductsErrors.productNotFound(id));
    return Result.success(product);
  }
}
