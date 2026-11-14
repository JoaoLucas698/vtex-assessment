import { Module } from '@nestjs/common';
import { CatalogImportModule } from '@modules/catalog-import/catalog-import.module';
import { ProductsModule } from '@modules/products/products.module';
import { SellersModule } from '@modules/sellers/sellers.module';
import { PrismaModule } from '@shared/prisma/prisma.module';

@Module({
  imports: [PrismaModule, ProductsModule, SellersModule, CatalogImportModule],
})
export class AppModule {}
