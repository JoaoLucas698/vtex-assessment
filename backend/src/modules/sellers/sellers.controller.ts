import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  LIST_SELLER_PRODUCTS_BAD_REQUEST_EXAMPLE,
  LIST_SELLERS_BAD_REQUEST_EXAMPLE,
  SELLER_NOT_FOUND_EXAMPLE,
} from '@modules/sellers/consts/sellers.swagger-examples';
import { ListSellerProductsResponseDto } from '@modules/sellers/schemas/dto/list-seller-products.response.dto';
import { ListSellersResponseDto } from '@modules/sellers/schemas/dto/list-sellers.response.dto';
import { SellerErrorCode } from '@modules/sellers/schemas/sellers.errors';
import { ListSellerProductsUseCase } from '@modules/sellers/usecases/list-seller-products.usecase';
import { ListSellersUseCase } from '@modules/sellers/usecases/list-sellers.usecase';
import { CommonErrorCode } from '@shared/errors/error-codes';
import { unwrapResult } from '@shared/errors/unwrap-result';
import { PaginationRequestDto } from '@shared/pagination/pagination.request.dto';

@ApiTags('sellers')
@Controller('sellers')
export class SellersController {
  constructor(
    private readonly listSellersUseCase: ListSellersUseCase,
    private readonly listSellerProductsUseCase: ListSellerProductsUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista os sellers com a quantidade de produtos.' })
  @ApiResponse({ status: 200, type: ListSellersResponseDto })
  @ApiResponse({
    status: 400,
    description: `Paginação inválida (${CommonErrorCode.VALIDATION_ERROR}).`,
    schema: { example: LIST_SELLERS_BAD_REQUEST_EXAMPLE },
  })
  async list(
    @Query() query: PaginationRequestDto,
  ): Promise<ListSellersResponseDto> {
    const result = await this.listSellersUseCase.execute({
      page: query.page,
      pageSize: query.pageSize,
    });
    return ListSellersResponseDto.from(unwrapResult(result));
  }

  @Get(':id/products')
  @ApiOperation({
    summary:
      'Lista os produtos de um seller, com os dados como o seller enviou e o produto oficial.',
  })
  @ApiParam({ name: 'id', description: 'Id do seller.', example: 1 })
  @ApiResponse({ status: 200, type: ListSellerProductsResponseDto })
  @ApiResponse({
    status: 400,
    description: `Id ou paginação inválidos (${CommonErrorCode.VALIDATION_ERROR}).`,
    schema: { example: LIST_SELLER_PRODUCTS_BAD_REQUEST_EXAMPLE },
  })
  @ApiResponse({
    status: 404,
    description: `Seller não encontrado (${SellerErrorCode.SELLER_NOT_FOUND}).`,
    schema: { example: SELLER_NOT_FOUND_EXAMPLE },
  })
  async listProducts(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PaginationRequestDto,
  ): Promise<ListSellerProductsResponseDto> {
    const result = await this.listSellerProductsUseCase.execute({
      sellerId: id,
      page: query.page,
      pageSize: query.pageSize,
    });
    return ListSellerProductsResponseDto.from(unwrapResult(result));
  }
}
