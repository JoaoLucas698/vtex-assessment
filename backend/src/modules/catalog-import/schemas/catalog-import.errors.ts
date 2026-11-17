import { HttpStatus } from '@nestjs/common';
import type { AppError } from '@shared/errors/app-error';
import { registerErrorStatuses } from '@shared/errors/error-http-status';

/** Erros de negócio da importação de catálogo (`CLAUDE.md` §3, D-032). */
export enum CatalogImportErrorCode {
  /** Nenhum arquivo enviado no campo `file`. */
  FILE_REQUIRED = 'FILE_REQUIRED',
  /** O conteúdo não é JSON válido ou não é um array de itens. */
  INVALID_FILE = 'INVALID_FILE',
  /** O arquivo é um array JSON sem nenhum item (D-081). */
  EMPTY_FILE = 'EMPTY_FILE',
  /** O campo `normalizationType` não é um tipo de normalização cadastrado (D-113). */
  INVALID_NORMALIZATION_TYPE = 'INVALID_NORMALIZATION_TYPE',
}

registerErrorStatuses({
  [CatalogImportErrorCode.FILE_REQUIRED]: HttpStatus.BAD_REQUEST,
  [CatalogImportErrorCode.INVALID_FILE]: HttpStatus.BAD_REQUEST,
  [CatalogImportErrorCode.EMPTY_FILE]: HttpStatus.BAD_REQUEST,
  [CatalogImportErrorCode.INVALID_NORMALIZATION_TYPE]: HttpStatus.BAD_REQUEST,
});

export const CatalogImportErrors = {
  fileRequired: (): AppError => ({
    code: CatalogImportErrorCode.FILE_REQUIRED,
    message: 'Envie o arquivo de carga no campo "file".',
  }),
  invalidJson: (detail: string): AppError => ({
    code: CatalogImportErrorCode.INVALID_FILE,
    message: 'O arquivo não é um JSON válido.',
    details: detail,
  }),
  notAnArray: (): AppError => ({
    code: CatalogImportErrorCode.INVALID_FILE,
    message: 'O arquivo precisa conter um array JSON de itens.',
  }),
  emptyFile: (): AppError => ({
    code: CatalogImportErrorCode.EMPTY_FILE,
    message: 'O arquivo não tem nenhum item para importar.',
  }),
  invalidNormalizationType: (code: string): AppError => ({
    code: CatalogImportErrorCode.INVALID_NORMALIZATION_TYPE,
    message: `Tipo de normalização inválido: "${code}". Use um dos tipos de GET /api/normalization-types.`,
  }),
};
