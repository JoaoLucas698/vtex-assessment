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
import { CatalogImportErrorCode } from '@modules/catalog-import/schemas/catalog-import.errors';
import {
  CATALOG_FILE_FIELD,
  ImportItemOutcome,
  MatchedBy,
  MAX_CATALOG_FILE_SIZE_BYTES,
  type UploadedCatalogFile,
} from '@modules/catalog-import/schemas/catalog-import.types';
import { ImportCatalogRequestDto } from '@modules/catalog-import/schemas/dto/import-catalog.request.dto';
import { ImportCatalogResponseDto } from '@modules/catalog-import/schemas/dto/import-catalog.response.dto';
import { ImportCatalogUseCase } from '@modules/catalog-import/usecases/import-catalog.usecase';
import { unwrapResult } from '@shared/errors/unwrap-result';

const REPORT_EXAMPLE = {
  totals: {
    read: 4,
    invalid: 1,
    created: 1,
    linkedExisting: 1,
    alreadyLinked: 0,
    duplicateSameSeller: 1,
  },
  items: [
    {
      index: 0,
      externalId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
      sellerName: 'MegaStore',
      name: 'Smartphone Galaxy S23',
      outcome: ImportItemOutcome.CREATED,
      productId: 976,
      matchedBy: MatchedBy.NEW,
      reason: null,
    },
    {
      index: 1,
      externalId: 'f0e1d2c3-b4a5-4968-8776-655443322110',
      sellerName: 'FitnessCenter',
      name: 'Smartphone Galaxy  S23',
      outcome: ImportItemOutcome.LINKED_EXISTING,
      productId: 976,
      matchedBy: MatchedBy.NORMALIZED_KEY,
      reason: null,
    },
    {
      index: 2,
      externalId: '11111111-2222-4333-8444-555555555555',
      sellerName: 'MegaStore',
      name: 'smartphone galaxy s23',
      outcome: ImportItemOutcome.DUPLICATE_SAME_SELLER,
      productId: 976,
      matchedBy: null,
      reason:
        'O seller já está vinculado a este produto com o externalId "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d". Vale o primeiro recebido; este item não foi gravado.',
    },
    {
      index: 3,
      externalId: null,
      sellerName: 'MegaStore',
      name: 'Mouse',
      outcome: ImportItemOutcome.INVALID,
      productId: null,
      matchedBy: null,
      reason: 'Id ausente.',
    },
  ],
};

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
    example: REPORT_EXAMPLE,
  })
  @ApiResponse({
    status: 400,
    description: `Arquivo ausente (${CatalogImportErrorCode.FILE_REQUIRED}), JSON inválido ou que não é um array (${CatalogImportErrorCode.INVALID_FILE}), ou array sem itens (${CatalogImportErrorCode.EMPTY_FILE}).`,
    content: {
      'application/json': {
        examples: {
          [CatalogImportErrorCode.FILE_REQUIRED]: {
            value: {
              statusCode: 400,
              code: CatalogImportErrorCode.FILE_REQUIRED,
              message: 'Envie o arquivo de carga no campo "file".',
            },
          },
          [CatalogImportErrorCode.INVALID_FILE]: {
            value: {
              statusCode: 400,
              code: CatalogImportErrorCode.INVALID_FILE,
              message: 'O arquivo não é um JSON válido.',
              details:
                "Expected ',' or ']' after array element in JSON at position 120",
            },
          },
          [CatalogImportErrorCode.EMPTY_FILE]: {
            value: {
              statusCode: 400,
              code: CatalogImportErrorCode.EMPTY_FILE,
              message: 'O arquivo não tem nenhum item para importar.',
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 413,
    description: 'Arquivo maior que 5 MB (limite do upload, D-083).',
    schema: {
      example: {
        statusCode: 413,
        code: 'INTERNAL_ERROR',
        message: 'File too large',
      },
    },
  })
  async import(
    @UploadedFile() file: UploadedCatalogFile | undefined,
  ): Promise<ImportCatalogResponseDto> {
    const result = await this.importCatalogUseCase.execute({ file });
    return ImportCatalogResponseDto.from(unwrapResult(result));
  }
}
