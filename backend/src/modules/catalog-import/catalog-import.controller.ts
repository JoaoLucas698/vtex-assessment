import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CATALOG_FILE_FIELD,
  MAX_CATALOG_FILE_SIZE_BYTES,
} from '@modules/catalog-import/consts/catalog-import.consts';
import {
  IMPORT_CATALOG_BAD_REQUEST_EXAMPLES,
  IMPORT_CATALOG_PAYLOAD_TOO_LARGE_EXAMPLE,
  IMPORT_CATALOG_REPORT_EXAMPLE,
} from '@modules/catalog-import/consts/catalog-import.swagger-examples';
import { CatalogImportErrorCode } from '@modules/catalog-import/schemas/catalog-import.errors';
import type { UploadedCatalogFile } from '@modules/catalog-import/schemas/catalog-import.types';
import { ImportCatalogRequestDto } from '@modules/catalog-import/schemas/dto/import-catalog.request.dto';
import { ImportCatalogResponseDto } from '@modules/catalog-import/schemas/dto/import-catalog.response.dto';
import { ImportCatalogUseCase } from '@modules/catalog-import/usecases/import-catalog.usecase';
import { CommonErrorCode } from '@shared/errors/error-codes';
import { unwrapResult } from '@shared/errors/unwrap-result';

@ApiTags('catalog-import')
@Controller('catalog-import')
export class CatalogImportController {
  constructor(private readonly importCatalogUseCase: ImportCatalogUseCase) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor(CATALOG_FILE_FIELD, {
      limits: { fileSize: MAX_CATALOG_FILE_SIZE_BYTES, files: 1 },
    }),
  )
  @ApiOperation({
    summary:
      'Importa um arquivo JSON de produtos de sellers e consolida no catálogo, sem duplicar produtos.',
    description:
      'Processa os itens na ordem do arquivo, numa única transação. Itens inválidos são rejeitados individualmente e aparecem no relatório com o motivo. Reimportar o mesmo arquivo não altera o catálogo (idempotente).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: ImportCatalogRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Relatório da importação.',
    type: ImportCatalogResponseDto,
    example: IMPORT_CATALOG_REPORT_EXAMPLE,
  })
  @ApiResponse({
    status: 400,
    description: `Arquivo ausente (${CatalogImportErrorCode.FILE_REQUIRED}), JSON inválido ou que não é um array (${CatalogImportErrorCode.INVALID_FILE}), ou array sem itens (${CatalogImportErrorCode.EMPTY_FILE}).`,
    content: {
      'application/json': {
        examples: IMPORT_CATALOG_BAD_REQUEST_EXAMPLES,
      },
    },
  })
  @ApiResponse({
    status: 413,
    description: `Arquivo maior que 5 MB (${CommonErrorCode.PAYLOAD_TOO_LARGE}, limite do upload, D-083).`,
    schema: { example: IMPORT_CATALOG_PAYLOAD_TOO_LARGE_EXAMPLE },
  })
  async import(
    @UploadedFile() file: UploadedCatalogFile | undefined,
  ): Promise<ImportCatalogResponseDto> {
    const result = await this.importCatalogUseCase.execute({ file });
    return ImportCatalogResponseDto.from(unwrapResult(result));
  }
}
