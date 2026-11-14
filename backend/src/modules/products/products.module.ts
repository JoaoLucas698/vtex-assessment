import { Module } from '@nestjs/common';
import { ProductNormalizerService } from '@modules/catalog-import/services/product-normalizer.service';
import { ProductsController } from '@modules/products/products.controller';
import { ProductRepository } from '@modules/products/repositories/product.repository';
import { GetProductDetailUseCase } from '@modules/products/usecases/get-product-detail.usecase';
import { ListProductsUseCase } from '@modules/products/usecases/list-products.usecase';

/**
 * `ProductNormalizerService` é registrado aqui por ser um service puro e sem estado (D-070).
 */
@Module({
  controllers: [ProductsController],
  providers: [
    ProductRepository,
    ProductNormalizerService,
    ListProductsUseCase,
    GetProductDetailUseCase,
  ],
  exports: [ProductRepository],
})
export class ProductsModule {}
