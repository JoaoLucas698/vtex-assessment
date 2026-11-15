import { Injectable } from '@nestjs/common';
import { CatalogItemField } from '@modules/catalog-import/consts/catalog-import.consts';
import { CatalogImportErrors } from '@modules/catalog-import/schemas/catalog-import.errors';
import {
  InvalidCatalogItem,
  ParsedCatalogFile,
  ValidCatalogItem,
} from '@modules/catalog-import/schemas/catalog-import.types';
import { Result } from '@shared/result/result';

/** BOM do UTF-8: aparece em arquivos salvos por alguns editores e quebra o `JSON.parse` (D-081). */
const UTF8_BOM = '\uFEFF';

type RequiredTextField =
  | typeof CatalogItemField.ID
  | typeof CatalogItemField.SELLER_NAME
  | typeof CatalogItemField.NAME;

type OptionalTextField =
  typeof CatalogItemField.BRAND | typeof CatalogItemField.CATEGORY;

type RawItem = Readonly<Record<string, unknown>>;

/**
 * Lê o arquivo de carga e valida cada item (D-011, D-081, D-082).
 *
 * Service sem acesso ao banco. Retorna `Result` porque o arquivo pode ser inválido
 * de forma esperada (JSON quebrado, não-array, array vazio). Um item inválido **não**
 * derruba o arquivo: ele vai para `invalid` com o motivo.
 *
 * Não valida o formato do `Id` (D-009) e não "limpa" nenhum texto: o trim é usado só
 * para decidir se o campo está vazio, e o valor guardado é o original (`CLAUDE.md` §5).
 */
@Injectable()
export class CatalogFileParserService {
  parse(content: Buffer): Result<ParsedCatalogFile> {
    const json = this.parseJson(content);
    if (json.isFailure) return json;

    const items = json.value;
    if (!Array.isArray(items))
      return Result.error(CatalogImportErrors.notAnArray());
    if (items.length === 0)
      return Result.error(CatalogImportErrors.emptyFile());

    const valid: ValidCatalogItem[] = [];
    const invalid: InvalidCatalogItem[] = [];
    items.forEach((raw: unknown, index) => {
      const item = this.validateItem(raw, index);
      if ('reason' in item) invalid.push(item);
      else valid.push(item);
    });
    return Result.success({ total: items.length, valid, invalid });
  }

  private parseJson(content: Buffer): Result<unknown> {
    const text = content.toString('utf8');
    const withoutBom = text.startsWith(UTF8_BOM) ? text.slice(1) : text;
    try {
      const value: unknown = JSON.parse(withoutBom);
      return Result.success(value);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return Result.error(CatalogImportErrors.invalidJson(detail));
    }
  }

  private validateItem(
    raw: unknown,
    index: number,
  ): ValidCatalogItem | InvalidCatalogItem {
    if (!this.isObject(raw)) {
      return {
        index,
        externalId: null,
        sellerName: null,
        name: null,
        reason: 'O item não é um objeto JSON.',
      };
    }

    const reasons = [
      this.checkRequiredText(raw, CatalogItemField.ID),
      this.checkRequiredText(raw, CatalogItemField.SELLER_NAME),
      this.checkRequiredText(raw, CatalogItemField.NAME),
      this.checkOptionalText(raw, CatalogItemField.BRAND),
      this.checkOptionalText(raw, CatalogItemField.CATEGORY),
    ].filter((reason): reason is string => reason !== null);

    const externalId = this.textOrNull(raw[CatalogItemField.ID]);
    const sellerName = this.textOrNull(raw[CatalogItemField.SELLER_NAME]);
    const name = this.textOrNull(raw[CatalogItemField.NAME]);

    if (
      reasons.length > 0 ||
      externalId === null ||
      sellerName === null ||
      name === null
    ) {
      return { index, externalId, sellerName, name, reason: reasons.join(' ') };
    }

    return {
      index,
      externalId,
      sellerName,
      name,
      brand: this.textOrNull(raw[CatalogItemField.BRAND]),
      category: this.textOrNull(raw[CatalogItemField.CATEGORY]),
    };
  }

  /** `Id`, `SellerName` e `Name`: obrigatórios, texto e não vazios após trim. */
  private checkRequiredText(
    item: RawItem,
    field: RequiredTextField,
  ): string | null {
    const value = item[field];
    if (value === undefined || value === null) return `${field} ausente.`;
    if (typeof value !== 'string') return `${field} precisa ser texto.`;
    if (value.trim() === '') return `${field} vazio.`;
    return null;
  }

  /** `Brand` e `Category`: aceitam ausência e `null`; se vierem, precisam ser texto. */
  private checkOptionalText(
    item: RawItem,
    field: OptionalTextField,
  ): string | null {
    const value = item[field];
    if (value === undefined || value === null || typeof value === 'string') {
      return null;
    }
    return `${field} precisa ser texto ou null.`;
  }

  private textOrNull(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }

  private isObject(value: unknown): value is RawItem {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
