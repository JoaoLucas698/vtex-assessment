import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  ListSellerProductsOutput,
  SellerProductOutput,
} from '@modules/sellers/schemas/seller.types';

export class OfficialProductResponseDto {
  @ApiProperty({ description: 'Id do produto oficial.', example: 10 })
  id!: number;

  @ApiProperty({
    description: 'Nome do produto oficial do catálogo.',
    example: 'Notebook Dell Inspiron 15',
  })
  name!: string;
}

export class SellerResponseDto {
  @ApiProperty({ description: 'Id do seller.', example: 1 })
  id!: number;

  @ApiProperty({ description: 'Nome do seller.', example: 'Loja A' })
  sellerName!: string;
}

export class SellerProductResponseDto {
  @ApiProperty({ description: 'Id do vínculo seller ↔ produto.', example: 7 })
  id!: number;

  @ApiPropertyOptional({
    description: 'Id do produto no sistema do seller. Null se não informado.',
    example: 'SKU-001',
    nullable: true,
    type: String,
  })
  externalId!: string | null;

  @ApiProperty({
    description: 'Nome como o seller enviou.',
    example: 'Notebook Dell Inspiron 15"',
  })
  name!: string;

  @ApiPropertyOptional({
    description: 'Marca como o seller enviou. Null se o seller não informou.',
    example: 'Dell',
    nullable: true,
    type: String,
  })
  brand!: string | null;

  @ApiPropertyOptional({
    description:
      'Categoria como o seller enviou. Null se o seller não informou.',
    example: 'Notebooks',
    nullable: true,
    type: String,
  })
  category!: string | null;

  @ApiProperty({
    description: 'Origem do vínculo.',
    example: 'normalized_key',
    enum: ['new', 'normalized_key', 'legacy'],
  })
  matchedBy!: string;

  @ApiProperty({
    description: 'Produto oficial do catálogo ao qual o vínculo pertence.',
    type: OfficialProductResponseDto,
  })
  product!: OfficialProductResponseDto;

  static from(output: SellerProductOutput): SellerProductResponseDto {
    const dto = new SellerProductResponseDto();
    dto.id = output.id;
    dto.externalId = output.externalId;
    dto.name = output.name;
    dto.brand = output.brand;
    dto.category = output.category;
    dto.matchedBy = output.matchedBy;
    dto.product = { id: output.product.id, name: output.product.name };
    return dto;
  }
}

export class ListSellerProductsResponseDto {
  @ApiProperty({
    description: 'Seller dono dos produtos.',
    type: SellerResponseDto,
  })
  seller!: SellerResponseDto;

  @ApiProperty({
    description: 'Produtos do seller na página.',
    type: [SellerProductResponseDto],
  })
  items!: SellerProductResponseDto[];

  @ApiProperty({ description: 'Total de produtos do seller.', example: 42 })
  total!: number;

  @ApiProperty({ description: 'Página retornada.', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Tamanho da página.', example: 20 })
  pageSize!: number;

  static from(output: ListSellerProductsOutput): ListSellerProductsResponseDto {
    const dto = new ListSellerProductsResponseDto();
    dto.seller = { id: output.seller.id, sellerName: output.seller.sellerName };
    dto.items = output.items.map((item) => SellerProductResponseDto.from(item));
    dto.total = output.total;
    dto.page = output.page;
    dto.pageSize = output.pageSize;
    return dto;
  }
}
