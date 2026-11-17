import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { NormalizationTypeCode } from '@modules/normalization-types/schemas/normalization-type.types';

/** Tamanho máximo aceito no campo `normalizationType` (os códigos têm menos de 30). */
const NORMALIZATION_TYPE_MAX_LENGTH = 64;

/**
 * Corpo multipart do upload. O arquivo chega pelo `FileInterceptor` (o campo `file`
 * está aqui só para documentar no Swagger) e é validado pelo usecase. O campo de
 * texto `normalizationType` chega pelo `@Body()`.
 */
export class ImportCatalogRequestDto {
  @ApiProperty({
    description:
      'Arquivo JSON com um array de itens `{ Id, SellerName, Name, Brand, Category }` (máximo 5 MB).',
    type: 'string',
    format: 'binary',
    example: 'carga.json',
  })
  file!: unknown;

  /**
   * Validado aqui só quanto ao tipo e tamanho. Se é um tipo cadastrado, quem decide é
   * o usecase, que devolve `INVALID_NORMALIZATION_TYPE` (D-113).
   */
  @ApiPropertyOptional({
    description:
      'Regra de normalização da chave dos produtos criados nesta importação (ver `GET /api/normalization-types`). Ausente usa `NAME_BRAND` (marca + nome). Itens que batem com um produto existente são ligados a ele pela regra do próprio produto.',
    enum: NormalizationTypeCode,
    enumName: 'NormalizationTypeCode',
    example: NormalizationTypeCode.NAME_CATEGORY,
    default: NormalizationTypeCode.NAME_BRAND,
  })
  @IsOptional()
  @IsString()
  @MaxLength(NORMALIZATION_TYPE_MAX_LENGTH)
  normalizationType?: string;
}
