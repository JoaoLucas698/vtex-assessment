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

  /**
   * D-014: o banco guarda `null` quando o seller não informou `brand`/`category`;
   * na resposta, esses campos usam o dado do produto oficial. Só `null` cai para
   * o oficial; `externalId` não tem equivalente e continua como está.
   */
  private fillMissingSellerData(
    product: ProductWithSellers,
  ): Result<ProductWithSellers, AppError> {
    return Result.success({
      ...product,
      sellers: product.sellers.map((seller) => ({
        ...seller,
        brand: seller.brand ?? product.brand,
        category: seller.category ?? product.category,
      })),
    });
  }
}
