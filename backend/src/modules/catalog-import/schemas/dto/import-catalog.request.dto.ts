import { ApiProperty } from '@nestjs/swagger';

/**
 * Corpo multipart do upload. Usado só para documentar o campo `file` no Swagger:
 * o arquivo chega pelo `FileInterceptor` e é validado pelo usecase.
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
}
