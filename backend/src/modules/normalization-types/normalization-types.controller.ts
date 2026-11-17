import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LIST_NORMALIZATION_TYPES_OK_EXAMPLE } from '@modules/normalization-types/consts/normalization-types.swagger-examples';
import { ListNormalizationTypesResponseDto } from '@modules/normalization-types/schemas/dto/list-normalization-types.response.dto';
import { ListNormalizationTypesUseCase } from '@modules/normalization-types/usecases/list-normalization-types.usecase';
import { unwrapResult } from '@shared/errors/unwrap-result';

@ApiTags('normalization-types')
@Controller('normalization-types')
export class NormalizationTypesController {
  constructor(
    private readonly listNormalizationTypesUseCase: ListNormalizationTypesUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Lista os tipos de normalização da chave do produto (quais campos entram na chave).',
  })
  @ApiResponse({
    status: 200,
    type: ListNormalizationTypesResponseDto,
    example: LIST_NORMALIZATION_TYPES_OK_EXAMPLE,
  })
  async list(): Promise<ListNormalizationTypesResponseDto> {
    const result = await this.listNormalizationTypesUseCase.execute();
    return ListNormalizationTypesResponseDto.from(unwrapResult(result));
  }
}
