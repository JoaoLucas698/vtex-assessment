import { Module } from '@nestjs/common';
import { SellersController } from '@modules/sellers/sellers.controller';
import { SellerProductRepository } from '@modules/sellers/repositories/seller-product.repository';
import { SellerRepository } from '@modules/sellers/repositories/seller.repository';
import { ListSellerProductsUseCase } from '@modules/sellers/usecases/list-seller-products.usecase';
import { ListSellersUseCase } from '@modules/sellers/usecases/list-sellers.usecase';

@Module({
  controllers: [SellersController],
  providers: [
    SellerRepository,
    SellerProductRepository,
    ListSellersUseCase,
    ListSellerProductsUseCase,
  ],
  exports: [SellerRepository, SellerProductRepository],
})
export class SellersModule {}
