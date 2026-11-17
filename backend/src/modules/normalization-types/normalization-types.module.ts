import { Module } from '@nestjs/common';
import { NormalizationTypesController } from '@modules/normalization-types/normalization-types.controller';
import { NormalizationTypeRepository } from '@modules/normalization-types/repositories/normalization-type.repository';
import { ListNormalizationTypesUseCase } from '@modules/normalization-types/usecases/list-normalization-types.usecase';

/** Tipos de normalização da chave do produto (D-110). Somente leitura. */
@Module({
  controllers: [NormalizationTypesController],
  providers: [NormalizationTypeRepository, ListNormalizationTypesUseCase],
  exports: [NormalizationTypeRepository],
})
export class NormalizationTypesModule {}
