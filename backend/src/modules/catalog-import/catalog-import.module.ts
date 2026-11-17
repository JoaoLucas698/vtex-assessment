import { Module } from '@nestjs/common';
import { CatalogImportController } from '@modules/catalog-import/catalog-import.controller';
import { CatalogFileParserService } from '@modules/catalog-import/services/catalog-file-parser.service';
import { ImportReportService } from '@modules/catalog-import/services/import-report.service';
import { ProductMatchingService } from '@modules/catalog-import/services/product-matching.service';
import { ProductNormalizerService } from '@modules/catalog-import/services/product-normalizer.service';
import { ImportCatalogUseCase } from '@modules/catalog-import/usecases/import-catalog.usecase';
import { NormalizationTypesModule } from '@modules/normalization-types/normalization-types.module';
import { ProductsModule } from '@modules/products/products.module';
import { SellersModule } from '@modules/sellers/sellers.module';

/**
 * Importação do arquivo de carga. Usa os repositories exportados por `SellersModule`,
 * `ProductsModule` e `NormalizationTypesModule`; o `TransactionManager` vem do `PrismaModule` (global).
 */
@Module({
  imports: [SellersModule, ProductsModule, NormalizationTypesModule],
  controllers: [CatalogImportController],
  providers: [
    ProductNormalizerService,
    ProductMatchingService,
    CatalogFileParserService,
    ImportReportService,
    ImportCatalogUseCase,
  ],
})
export class CatalogImportModule {}
