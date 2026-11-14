import { ApiProperty } from '@nestjs/swagger';
import type { ProductWithSellers } from '@modules/products/schemas/product.types';

export class ProductSellerDto {
  @ApiProperty({ description: 'Id do seller.', example: 7 })
  sellerId!: number;

  @ApiProperty({ description: 'Nome do seller.', example: 'Loja A' })
  sellerName!: string;

  @ApiProperty({
    description: 'Id do produto no seller, ou null.',
    example: 'SKU-123',
    nullable: true,
    type: String,
  })
  externalId!: string | null;

  @ApiProperty({
    description: 'Nome como o seller enviou.',
    example: 'Tenis Nike  Air Max',
  })
  name!: string;

  @ApiProperty({
    description: 'Marca como o seller enviou, ou null.',
    example: "Levi's",
    nullable: true,
    type: String,
  })
  brand!: string | null;

  @ApiProperty({
    description: 'Categoria como o seller enviou, ou null.',
    example: 'Calçados',
    nullable: true,
    type: String,
  })
  category!: string | null;

  @ApiProperty({
    description: 'Critério pelo qual o vínculo foi criado.',
    example: 'normalized_key',
  })
  matchedBy!: string;
}

export class GetProductDetailResponseDto {
  @ApiProperty({ description: 'Id do produto oficial.', example: 1 })
  id!: number;

  @ApiProperty({ description: 'Nome oficial.', example: 'Tênis Nike Air Max' })
  name!: string;

  @ApiProperty({
    description: 'Marca oficial, ou null.',
    example: 'Nike',
    nullable: true,
    type: String,
  })
  brand!: string | null;

  @ApiProperty({
    description: 'Categoria oficial, ou null.',
    example: 'Calçados',
    nullable: true,
    type: String,
  })
  category!: string | null;

  @ApiProperty({
    type: [ProductSellerDto],
    description:
      'Sellers que oferecem o produto, com os dados que cada um enviou.',
  })
  sellers!: ProductSellerDto[];

  static from(product: ProductWithSellers): GetProductDetailResponseDto {
    return {
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      sellers: product.sellers.map((seller) => ({
        sellerId: seller.sellerId,
        sellerName: seller.sellerName,
        externalId: seller.externalId,
        name: seller.name,
        brand: seller.brand,
        category: seller.category,
        matchedBy: seller.matchedBy,
      })),
    };
  }
}
