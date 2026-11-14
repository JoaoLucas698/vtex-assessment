import { ApiProperty } from '@nestjs/swagger';
import {
  ImportCatalogOutput,
  ImportItemOutcome,
  ImportItemReport,
  ImportTotals,
  MatchedBy,
} from '@modules/catalog-import/schemas/catalog-import.types';

export class ImportTotalsResponseDto {
  @ApiProperty({
    description: 'Itens lidos do arquivo (tamanho do array, válidos ou não).',
    example: 269,
  })
  read!: number;

  @ApiProperty({
    description:
      'Itens rejeitados na validação (sem `Id`, `SellerName` ou `Name`, ou com tipo errado).',
    example: 0,
  })
  invalid!: number;

  @ApiProperty({
    description: 'Itens que criaram um produto novo (`matchedBy = new`).',
    example: 201,
  })
  created!: number;

  @ApiProperty({
    description:
      'Itens ligados a um produto existente pela chave normalizada (`matchedBy = normalized_key`).',
    example: 56,
  })
  linkedExisting!: number;

  @ApiProperty({
    description:
      'Reenvios do mesmo `Id` pelo mesmo seller: vínculo mantido e dados do seller atualizados.',
    example: 1,
  })
  alreadyLinked!: number;

  @ApiProperty({
    description:
      'Mesmo produto enviado de novo pelo mesmo seller com outro `Id`: nada gravado, vale o primeiro.',
    example: 11,
  })
  duplicateSameSeller!: number;

  static from(totals: ImportTotals): ImportTotalsResponseDto {
    const dto = new ImportTotalsResponseDto();
    dto.read = totals.read;
    dto.invalid = totals.invalid;
    dto.created = totals.created;
    dto.linkedExisting = totals.linkedExisting;
    dto.alreadyLinked = totals.alreadyLinked;
    dto.duplicateSameSeller = totals.duplicateSameSeller;
    return dto;
  }
}

export class ImportItemResponseDto {
  @ApiProperty({
    description: 'Posição do item no array do arquivo (começa em 0).',
    example: 0,
  })
  index!: number;

  @ApiProperty({
    description:
      '`Id` do item no arquivo (código do produto na loja do seller). `null` quando ausente ou não é texto.',
    example: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    type: String,
    nullable: true,
  })
  externalId!: string | null;

  @ApiProperty({
    description: '`SellerName` do item. `null` quando ausente ou não é texto.',
    example: 'MegaStore',
    type: String,
    nullable: true,
  })
  sellerName!: string | null;

  @ApiProperty({
    description: '`Name` do item. `null` quando ausente ou não é texto.',
    example: 'Smartphone Galaxy S23',
    type: String,
    nullable: true,
  })
  name!: string | null;

  @ApiProperty({
    description: 'O que aconteceu com o item.',
    enum: ImportItemOutcome,
    enumName: 'ImportItemOutcome',
    example: ImportItemOutcome.CREATED,
  })
  outcome!: ImportItemOutcome;

  @ApiProperty({
    description:
      'Produto oficial ligado ao item. Em `duplicate_same_seller`, é o produto que já tem o vínculo. `null` para `invalid`.',
    example: 976,
    type: Number,
    nullable: true,
  })
  productId!: number | null;

  @ApiProperty({
    description:
      'Critério do vínculo: `new` (criou o produto), `normalized_key` (ligado pela chave) ou, em `already_linked`, o critério do vínculo existente (pode ser `legacy`). `null` para `invalid` e `duplicate_same_seller`.',
    enum: MatchedBy,
    enumName: 'MatchedBy',
    example: MatchedBy.NEW,
    nullable: true,
  })
  matchedBy!: string | null;

  @ApiProperty({
    description:
      'Motivo legível, preenchido só para `invalid` e `duplicate_same_seller`.',
    example: null,
    type: String,
    nullable: true,
  })
  reason!: string | null;

  static from(item: ImportItemReport): ImportItemResponseDto {
    const dto = new ImportItemResponseDto();
    dto.index = item.index;
    dto.externalId = item.externalId;
    dto.sellerName = item.sellerName;
    dto.name = item.name;
    dto.outcome = item.outcome;
    dto.productId = item.productId;
    dto.matchedBy = item.matchedBy;
    dto.reason = item.reason;
    return dto;
  }
}

export class ImportCatalogResponseDto {
  @ApiProperty({
    description: 'Totais por tipo de resultado.',
    type: ImportTotalsResponseDto,
  })
  totals!: ImportTotalsResponseDto;

  @ApiProperty({
    description: 'Uma linha por item do arquivo, na ordem do arquivo.',
    type: [ImportItemResponseDto],
  })
  items!: ImportItemResponseDto[];

  static from(output: ImportCatalogOutput): ImportCatalogResponseDto {
    const dto = new ImportCatalogResponseDto();
    dto.totals = ImportTotalsResponseDto.from(output.totals);
    dto.items = output.items.map((item) => ImportItemResponseDto.from(item));
    return dto;
  }
}
