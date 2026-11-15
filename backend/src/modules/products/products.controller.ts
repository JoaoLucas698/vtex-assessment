import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetProductDetailResponseDto } from '@modules/products/schemas/dto/get-product-detail.response.dto';
import { ListProductsRequestDto } from '@modules/products/schemas/dto/list-products.request.dto';
import { ListProductsResponseDto } from '@modules/products/schemas/dto/list-products.response.dto';
import { ProductsErrorCode } from '@modules/products/schemas/products.errors';
import { GetProductDetailUseCase } from '@modules/products/usecases/get-product-detail.usecase';
import { ListProductsUseCase } from '@modules/products/usecases/list-products.usecase';
import { unwrapResult } from '@shared/errors/unwrap-result';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly listProducts: ListProductsUseCase,
    private readonly getProductDetail: GetProductDetailUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista produtos com busca e paginação' })
  @ApiResponse({ status: 200, type: ListProductsResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Parâmetros de consulta inválidos.',
    schema: {
      example: {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Requisição inválida',
        details: ['pageSize must not be greater than 100'],
      },
    },
  })
  async list(
    @Query() query: ListProductsRequestDto,
  ): Promise<ListProductsResponseDto> {
    const result = await this.listProducts.execute({
      q: query.q,
      page: query.page,
      pageSize: query.pageSize,
    });
    return ListProductsResponseDto.from(unwrapResult(result));
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalha um produto com os sellers que o oferecem',
  })
  @ApiParam({ name: 'id', description: 'Id do produto.', example: 1 })
  @ApiResponse({ status: 200, type: GetProductDetailResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Id inválido.',
    schema: {
      example: {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Validation failed (numeric string is expected)',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: `Produto não encontrado (${ProductsErrorCode.PRODUCT_NOT_FOUND}).`,
    schema: {
      example: {
        statusCode: 404,
        code: ProductsErrorCode.PRODUCT_NOT_FOUND,
        message: 'Produto 999 não encontrado.',
      },
    },
  })
  async detail(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<GetProductDetailResponseDto> {
    const result = await this.getProductDetail.execute(id);
    return GetProductDetailResponseDto.from(unwrapResult(result));
  }
}
