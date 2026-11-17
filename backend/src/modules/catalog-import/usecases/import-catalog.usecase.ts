import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { CatalogImportErrors } from '@modules/catalog-import/schemas/catalog-import.errors';
import {
  AlreadyLinkedDecision,
  CreateProductDecision,
  DuplicateSameSellerDecision,
  ImportCatalogInput,
  ImportCatalogOutput,
  ImportItemReport,
  LinkExistingDecision,
  MatchDecision,
  MatchDecisionType,
  MatchedBy,
  MatchInput,
  ParsedCatalogFile,
  UploadedCatalogFile,
  ValidCatalogItem,
} from '@modules/catalog-import/schemas/catalog-import.types';
import { CatalogFileParserService } from '@modules/catalog-import/services/catalog-file-parser.service';
import { ImportReportService } from '@modules/catalog-import/services/import-report.service';
import { ProductMatchingService } from '@modules/catalog-import/services/product-matching.service';
import { ProductNormalizerService } from '@modules/catalog-import/services/product-normalizer.service';
import { LEGACY_NORMALIZATION_TYPE_ID } from '@modules/normalization-types/consts/normalization-types.consts';
import { ProductRepository } from '@modules/products/repositories/product.repository';
import { SellerProductRepository } from '@modules/sellers/repositories/seller-product.repository';
import { SellerRepository } from '@modules/sellers/repositories/seller.repository';
import { TransactionManager } from '@shared/prisma/transaction-manager';
import { Result } from '@shared/result/result';

/** Estado de uma execução da importação (nunca compartilhado entre execuções). */
interface ImportRun {
  /** Cache `sellerName → sellerId` dentro da importação (D-084). */
  readonly sellerIds: Map<string, number>;
}

/** Dados buscados antes da decisão de um item. */
interface ItemLookup {
  readonly sellerId: number;
  readonly normalizedKey: string;
  readonly matchInput: MatchInput;
}

/**
 * Importa o arquivo de carga e consolida os itens no catálogo (`docs/context.md` §5).
 *
 * Fluxo: arquivo presente → parse e validação por item → processamento dos itens
 * válidos, **em ordem e um a um**, numa única transação → relatório.
 *
 * A deduplicação dentro do próprio arquivo vem de cada item enxergar o que os itens
 * anteriores gravaram na mesma transação (o produto criado pelo item 3 já é achado
 * pela chave no item 50). O critério de decisão fica no `ProductMatchingService`.
 */
@Injectable()
export class ImportCatalogUseCase {
  constructor(
    private readonly transactionManager: TransactionManager,
    private readonly parser: CatalogFileParserService,
    private readonly normalizer: ProductNormalizerService,
    private readonly matching: ProductMatchingService,
    private readonly report: ImportReportService,
    private readonly sellerRepository: SellerRepository,
    private readonly sellerProductRepository: SellerProductRepository,
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(
    input: ImportCatalogInput,
  ): Promise<Result<ImportCatalogOutput>> {
    const file = this.ensureFileIsPresent(input);
    if (file.isFailure) return file;

    const parsed = this.parseFile(file.value);
    if (parsed.isFailure) return parsed;

    const processed = await this.transactionManager.run((tx) =>
      this.processValidItems(parsed.value.valid, tx),
    );
    if (processed.isFailure) return processed;

    return this.buildReport(parsed.value, processed.value);
  }

  private ensureFileIsPresent(
    input: ImportCatalogInput,
  ): Result<UploadedCatalogFile> {
    if (!input.file) return Result.error(CatalogImportErrors.fileRequired());
    return Result.success(input.file);
  }

  private parseFile(file: UploadedCatalogFile): Result<ParsedCatalogFile> {
    return this.parser.parse(file.buffer);
  }

  /** Processa os itens válidos na ordem do arquivo, um de cada vez, na transação. */
  private async processValidItems(
    items: ValidCatalogItem[],
    tx: Prisma.TransactionClient,
  ): Promise<Result<ImportItemReport[]>> {
    const run: ImportRun = { sellerIds: new Map() };
    const reports: ImportItemReport[] = [];
    for (const item of items) {
      const report = await this.processItem(item, run, tx);
      if (report.isFailure) return report;
      reports.push(report.value);
    }
    return Result.success(reports);
  }

  private async processItem(
    item: ValidCatalogItem,
    run: ImportRun,
    tx: Prisma.TransactionClient,
  ): Promise<Result<ImportItemReport>> {
    const sellerId = await this.resolveSeller(item.sellerName, run, tx);
    if (sellerId.isFailure) return sellerId;

    const lookup = await this.lookupMatchInput(item, sellerId.value, tx);
    if (lookup.isFailure) return lookup;

    const decision = this.decide(lookup.value);
    if (decision.isFailure) return decision;

    return this.applyDecision(item, lookup.value, decision.value, tx);
  }

  /** Acha o seller pelo nome exato ou cria na primeira aparição (D-008, D-084). */
  private async resolveSeller(
    sellerName: string,
    run: ImportRun,
    tx: Prisma.TransactionClient,
  ): Promise<Result<number>> {
    const cached = run.sellerIds.get(sellerName);
    if (cached !== undefined) return Result.success(cached);

    const seller =
      (await this.sellerRepository.findByName(sellerName, tx)) ??
      (await this.sellerRepository.create(sellerName, tx));
    run.sellerIds.set(sellerName, seller.id);
    return Result.success(seller.id);
  }

  /**
   * Busca, na transação, o que o matching precisa (D-040): o vínculo pelo
   * `(sellerId, externalId)`; se não houver, o produto pela chave e, se houver
   * produto, o vínculo do seller com ele.
   */
  private async lookupMatchInput(
    item: ValidCatalogItem,
    sellerId: number,
    tx: Prisma.TransactionClient,
  ): Promise<Result<ItemLookup>> {
    const normalizedKey = this.normalizer.buildKey(item.brand, item.name);
    const linkByExternalId =
      await this.sellerProductRepository.findBySellerAndExternalId(
        sellerId,
        item.externalId,
        tx,
      );
    if (linkByExternalId) {
      return Result.success({
        sellerId,
        normalizedKey,
        matchInput: {
          linkByExternalId,
          productByKey: null,
          sellerLinkToProduct: null,
        },
      });
    }

    const productByKey = await this.productRepository.findByTypeAndKey(
      LEGACY_NORMALIZATION_TYPE_ID,
      normalizedKey,
      tx,
    );
    const sellerLinkToProduct = productByKey
      ? await this.sellerProductRepository.findBySellerAndProduct(
          sellerId,
          productByKey.id,
          tx,
        )
      : null;
    return Result.success({
      sellerId,
      normalizedKey,
      matchInput: { linkByExternalId: null, productByKey, sellerLinkToProduct },
    });
  }

  private decide(lookup: ItemLookup): Result<MatchDecision> {
    return Result.success(this.matching.decide(lookup.matchInput));
  }

  private applyDecision(
    item: ValidCatalogItem,
    lookup: ItemLookup,
    decision: MatchDecision,
    tx: Prisma.TransactionClient,
  ): Promise<Result<ImportItemReport>> {
    switch (decision.type) {
      case MatchDecisionType.ALREADY_LINKED:
        return this.updateExistingLink(item, decision, tx);
      case MatchDecisionType.LINK_EXISTING:
        return this.linkToExistingProduct(item, lookup, decision, tx);
      case MatchDecisionType.CREATE_PRODUCT:
        return this.createProductAndLink(item, lookup, decision, tx);
      case MatchDecisionType.DUPLICATE_SAME_SELLER:
        return Promise.resolve(this.reportDuplicate(item, decision));
    }
  }

  /** Reenvio do mesmo `externalId`: atualiza os dados enviados pelo seller (D-007). */
  private async updateExistingLink(
    item: ValidCatalogItem,
    decision: AlreadyLinkedDecision,
    tx: Prisma.TransactionClient,
  ): Promise<Result<ImportItemReport>> {
    const link = await this.sellerProductRepository.updateSellerData(
      decision.sellerProductId,
      { name: item.name, brand: item.brand, category: item.category },
      tx,
    );
    return Result.success(
      this.report.processedItem(item, {
        outcome: this.matching.toOutcome(decision),
        productId: decision.productId,
        matchedBy: link.matchedBy,
        reason: null,
      }),
    );
  }

  /** Produto já existe com a mesma chave: só cria o vínculo (`normalized_key`). */
  private async linkToExistingProduct(
    item: ValidCatalogItem,
    lookup: ItemLookup,
    decision: LinkExistingDecision,
    tx: Prisma.TransactionClient,
  ): Promise<Result<ImportItemReport>> {
    const link = await this.createLink(
      item,
      lookup.sellerId,
      decision.productId,
      decision.matchedBy,
      tx,
    );
    if (link.isFailure) return link;

    return Result.success(
      this.report.processedItem(item, {
        outcome: this.matching.toOutcome(decision),
        productId: decision.productId,
        matchedBy: decision.matchedBy,
        reason: null,
      }),
    );
  }

  /**
   * Nenhum produto com a chave: cria o `Product` com os dados do seller (versão
   * oficial = primeiro seller, D-013) e o vínculo (`new`).
   */
  private async createProductAndLink(
    item: ValidCatalogItem,
    lookup: ItemLookup,
    decision: CreateProductDecision,
    tx: Prisma.TransactionClient,
  ): Promise<Result<ImportItemReport>> {
    const product = await this.productRepository.create(
      {
        name: item.name,
        brand: item.brand,
        category: item.category,
        normalizationTypeId: LEGACY_NORMALIZATION_TYPE_ID,
        normalizedKey: lookup.normalizedKey,
      },
      tx,
    );
    const link = await this.createLink(
      item,
      lookup.sellerId,
      product.id,
      decision.matchedBy,
      tx,
    );
    if (link.isFailure) return link;

    return Result.success(
      this.report.processedItem(item, {
        outcome: this.matching.toOutcome(decision),
        productId: product.id,
        matchedBy: decision.matchedBy,
        reason: null,
      }),
    );
  }

  /** Mesmo produto, mesmo seller, outro `externalId`: nada é gravado, vale o primeiro (D-012). */
  private reportDuplicate(
    item: ValidCatalogItem,
    decision: DuplicateSameSellerDecision,
  ): Result<ImportItemReport> {
    const kept =
      decision.existingExternalId === null
        ? 'um vínculo sem externalId'
        : `o externalId "${decision.existingExternalId}"`;
    return Result.success(
      this.report.processedItem(item, {
        outcome: this.matching.toOutcome(decision),
        productId: decision.productId,
        matchedBy: null,
        reason: `O seller já está vinculado a este produto com ${kept}. Vale o primeiro recebido; este item não foi gravado.`,
      }),
    );
  }

  /** Grava o vínculo com os dados exatamente como o seller enviou (D-014). */
  private async createLink(
    item: ValidCatalogItem,
    sellerId: number,
    productId: number,
    matchedBy: MatchedBy,
    tx: Prisma.TransactionClient,
  ): Promise<Result<number>> {
    const link = await this.sellerProductRepository.create(
      {
        productId,
        sellerId,
        externalId: item.externalId,
        name: item.name,
        brand: item.brand,
        category: item.category,
        matchedBy,
      },
      tx,
    );
    return Result.success(link.id);
  }

  private buildReport(
    parsed: ParsedCatalogFile,
    processed: ImportItemReport[],
  ): Result<ImportCatalogOutput> {
    return Result.success(
      this.report.build(parsed.total, parsed.invalid, processed),
    );
  }
}
