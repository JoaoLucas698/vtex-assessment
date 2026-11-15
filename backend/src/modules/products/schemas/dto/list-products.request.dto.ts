import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationRequestDto } from '@shared/pagination/pagination.request.dto';

/** Query da listagem: `page`/`pageSize` vêm do `PaginationRequestDto` compartilhado (D-060). */
export class ListProductsRequestDto extends PaginationRequestDto {
  @ApiPropertyOptional({
    description:
      'Termo de busca. Ignora maiúsculas, acentos e espaços repetidos; procura na marca e no nome.',
    example: 'tenis nike',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;
}
