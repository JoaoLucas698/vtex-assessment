import { ApiProperty } from '@nestjs/swagger';
import type { ListProductsOutput } from '@modules/products/schemas/product.types';

export class ProductListItemDto {
  @ApiProperty({ description: 'Id do produto oficial.', example: 1 })
  id!: number;

  @ApiProperty({
    description: 'Nome oficial (versão do primeiro seller).',
    example: 'Tênis Nike Air Max',
  })
  name!: string;

  @ApiProperty({
    description: 'Marca oficial, ou null quando não informada.',
    example: 'Nike',
    nullable: true,
    type: String,
  })
  brand!: string | null;

  @ApiProperty({
    description: 'Categoria oficial, ou null quando não informada.',
    example: 'Calçados',
    nullable: true,
    type: String,
  })
  category!: string | null;

  @ApiProperty({
    description: 'Quantidade de sellers que oferecem o produto.',
    example: 3,
  })
  sellersCount!: number;
}

export class ListProductsResponseDto {
  @ApiProperty({
    type: [ProductListItemDto],
    description: 'Produtos da página.',
  })
  items!: ProductListItemDto[];

  @ApiProperty({
    description: 'Total de produtos que atendem à busca.',
    example: 42,
  })
  total!: number;

  @ApiProperty({ description: 'Página retornada.', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Itens por página.', example: 20 })
  pageSize!: number;

  static from(output: ListProductsOutput): ListProductsResponseDto {
    return {
      items: output.items.map((item) => ({
        id: item.id,
        name: item.name,
        brand: item.brand,
        category: item.category,
        sellersCount: item.sellersCount,
      })),
      total: output.total,
      page: output.page,
      pageSize: output.pageSize,
    };
  }
}
