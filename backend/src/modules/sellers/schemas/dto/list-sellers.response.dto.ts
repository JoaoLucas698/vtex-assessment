import { ApiProperty } from '@nestjs/swagger';
import type {
  ListSellersOutput,
  SellerSummaryOutput,
} from '@modules/sellers/schemas/seller.types';

export class SellerSummaryResponseDto {
  @ApiProperty({ description: 'Id do seller.', example: 1 })
  id!: number;

  @ApiProperty({ description: 'Nome do seller.', example: 'Loja A' })
  sellerName!: string;

  @ApiProperty({
    description: 'Quantidade de produtos vinculados ao seller.',
    example: 42,
  })
  productCount!: number;

  static from(output: SellerSummaryOutput): SellerSummaryResponseDto {
    const dto = new SellerSummaryResponseDto();
    dto.id = output.id;
    dto.sellerName = output.sellerName;
    dto.productCount = output.productCount;
    return dto;
  }
}

export class ListSellersResponseDto {
  @ApiProperty({ type: [SellerSummaryResponseDto] })
  items!: SellerSummaryResponseDto[];

  @ApiProperty({ description: 'Total de sellers.', example: 3 })
  total!: number;

  @ApiProperty({ description: 'Página retornada.', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Tamanho da página.', example: 20 })
  pageSize!: number;

  static from(output: ListSellersOutput): ListSellersResponseDto {
    const dto = new ListSellersResponseDto();
    dto.items = output.items.map((item) => SellerSummaryResponseDto.from(item));
    dto.total = output.total;
    dto.page = output.page;
    dto.pageSize = output.pageSize;
    return dto;
  }
}
