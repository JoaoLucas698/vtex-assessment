import { ApiProperty } from '@nestjs/swagger';
import {
  NormalizationTypeCode,
  type ListNormalizationTypesOutput,
  type NormalizationTypeOutput,
} from '@modules/normalization-types/schemas/normalization-type.types';

export class NormalizationTypeResponseDto {
  @ApiProperty({ description: 'Id do tipo de normalização.', example: 1 })
  id!: number;

  @ApiProperty({
    description:
      'Código do tipo. O nome sempre faz parte da chave; o código diz o que entra junto.',
    enum: NormalizationTypeCode,
    example: NormalizationTypeCode.NAME_BRAND,
  })
  code!: string;

  @ApiProperty({
    description: 'Descrição legível do tipo.',
    example: 'Nome + Marca',
  })
  description!: string;

  @ApiProperty({
    description: 'Se a marca normalizada faz parte da chave.',
    example: true,
  })
  includesBrand!: boolean;

  @ApiProperty({
    description: 'Se a categoria normalizada faz parte da chave.',
    example: false,
  })
  includesCategory!: boolean;

  static from(output: NormalizationTypeOutput): NormalizationTypeResponseDto {
    const dto = new NormalizationTypeResponseDto();
    dto.id = output.id;
    dto.code = output.code;
    dto.description = output.description;
    dto.includesBrand = output.includesBrand;
    dto.includesCategory = output.includesCategory;
    return dto;
  }
}

export class ListNormalizationTypesResponseDto {
  @ApiProperty({
    description: 'Tipos de normalização, em ordem de id.',
    type: [NormalizationTypeResponseDto],
  })
  items!: NormalizationTypeResponseDto[];

  static from(
    output: ListNormalizationTypesOutput,
  ): ListNormalizationTypesResponseDto {
    const dto = new ListNormalizationTypesResponseDto();
    dto.items = output.items.map((item) =>
      NormalizationTypeResponseDto.from(item),
    );
    return dto;
  }
}
