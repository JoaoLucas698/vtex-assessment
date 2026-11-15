/** Exemplos do Swagger do módulo `catalog-import`, tipados pelo contrato real (D-038). */
import { HttpStatus } from '@nestjs/common';
import { CatalogImportErrorCode } from '@modules/catalog-import/schemas/catalog-import.errors';
import {
  ImportItemOutcome,
  MatchedBy,
  type ImportCatalogOutput,
} from '@modules/catalog-import/schemas/catalog-import.types';
import { CommonErrorCode } from '@shared/errors/error-codes';
import type { ErrorResponseBody } from '@shared/errors/error-response.types';

/** Relatório de exemplo da resposta 200 de `POST /api/catalog-import`. */
export const IMPORT_CATALOG_REPORT_EXAMPLE = {
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
} satisfies ImportCatalogOutput;

/** Exemplos das respostas 400, um por `code`, no formato `examples` do Swagger. */
export const IMPORT_CATALOG_BAD_REQUEST_EXAMPLES = {
  [CatalogImportErrorCode.FILE_REQUIRED]: {
    value: {
      statusCode: HttpStatus.BAD_REQUEST,
      code: CatalogImportErrorCode.FILE_REQUIRED,
      message: 'Envie o arquivo de carga no campo "file".',
    },
  },
  [CatalogImportErrorCode.INVALID_FILE]: {
    value: {
      statusCode: HttpStatus.BAD_REQUEST,
      code: CatalogImportErrorCode.INVALID_FILE,
      message: 'O arquivo não é um JSON válido.',
      details:
        "Expected ',' or ']' after array element in JSON at position 120",
    },
  },
  [CatalogImportErrorCode.EMPTY_FILE]: {
    value: {
      statusCode: HttpStatus.BAD_REQUEST,
      code: CatalogImportErrorCode.EMPTY_FILE,
      message: 'O arquivo não tem nenhum item para importar.',
    },
  },
} satisfies Partial<
  Record<CatalogImportErrorCode, { value: ErrorResponseBody }>
>;

/** Exemplo da resposta 413 (arquivo maior que o limite do upload, D-083). */
export const IMPORT_CATALOG_PAYLOAD_TOO_LARGE_EXAMPLE = {
  statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
  code: CommonErrorCode.PAYLOAD_TOO_LARGE,
  message: 'File too large',
} satisfies ErrorResponseBody;
