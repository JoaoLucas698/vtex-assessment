import { Injectable } from '@nestjs/common';
import { NormalizationTypeRepository } from '@modules/normalization-types/repositories/normalization-type.repository';
import type {
  ListNormalizationTypesOutput,
  NormalizationTypeRecord,
} from '@modules/normalization-types/schemas/normalization-type.types';
import type { AppError } from '@shared/errors/app-error';
import { Result } from '@shared/result/result';

/** Lista os tipos de normalização da chave do produto que a importação aceita (D-110). */
@Injectable()
export class ListNormalizationTypesUseCase {
  constructor(
    private readonly normalizationTypeRepository: NormalizationTypeRepository,
  ) {}

  async execute(): Promise<Result<ListNormalizationTypesOutput, AppError>> {
    const types = await this.findTypes();
    if (types.isFailure) return types;

    return this.buildOutput(types.value);
  }

  private async findTypes(): Promise<
    Result<NormalizationTypeRecord[], AppError>
  > {
    return Result.success(await this.normalizationTypeRepository.findAll());
  }

  private buildOutput(
    types: NormalizationTypeRecord[],
  ): Result<ListNormalizationTypesOutput, AppError> {
    return Result.success({
      items: types.map((type) => ({
        id: type.id,
        code: type.code,
        description: type.description,
        includesBrand: type.includesBrand,
        includesCategory: type.includesCategory,
      })),
    });
  }
}
