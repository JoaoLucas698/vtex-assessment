import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateProductData,
  ProductRecord,
  ProductSearchParams,
  ProductSearchResult,
  ProductWithSellers,
} from '@modules/products/schemas/product.types';
import { PrismaService } from '@shared/prisma/prisma.service';

@Injectable()
export class ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** A chave só é única dentro do tipo de normalização (D-111). */
  async findByTypeAndKey(
    normalizationTypeId: number,
    normalizedKey: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ProductRecord | null> {
    return this.client(tx).product.findUnique({
      where: {
        normalizationTypeId_normalizedKey: {
          normalizationTypeId,
          normalizedKey,
        },
      },
      select: PRODUCT_RECORD_SELECT,
    });
  }

  async create(
    data: CreateProductData,
    tx?: Prisma.TransactionClient,
  ): Promise<ProductRecord> {
    return this.client(tx).product.create({
      data: {
        name: data.name,
        brand: data.brand,
        category: data.category,
        normalizationTypeId: data.normalizationTypeId,
        normalizedKey: data.normalizedKey,
      },
      select: PRODUCT_RECORD_SELECT,
    });
  }

  /**
   * Busca paginada. `q` já vem normalizado: o filtro compara com `normalizedKey`
   * (marca + nome normalizados), pois o SQLite do Prisma não tem `mode: 'insensitive'`.
   * Ordenação estável por `id`.
   */
  async search({
    q,
    page,
    pageSize,
  }: ProductSearchParams): Promise<ProductSearchResult> {
    const where: Prisma.ProductWhereInput = q
      ? { normalizedKey: { contains: q } }
      : {};
    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          brand: true,
          category: true,
          _count: { select: { sellerProducts: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        brand: row.brand,
        category: row.category,
        sellersCount: row._count.sellerProducts,
      })),
      total,
    };
  }

  /** Leitura do agregado Product com os vínculos de seller (D-024). */
  async findByIdWithSellers(id: number): Promise<ProductWithSellers | null> {
    const row = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        brand: true,
        category: true,
        sellerProducts: {
          orderBy: { id: 'asc' },
          select: {
            externalId: true,
            name: true,
            brand: true,
            category: true,
            matchedBy: true,
            seller: { select: { id: true, sellerName: true } },
          },
        },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      brand: row.brand,
      category: row.category,
      sellers: row.sellerProducts.map((link) => ({
        sellerId: link.seller.id,
        sellerName: link.seller.sellerName,
        externalId: link.externalId,
        name: link.name,
        brand: link.brand,
        category: link.category,
        matchedBy: link.matchedBy,
      })),
    };
  }

  private client(tx?: Prisma.TransactionClient): Prisma.TransactionClient {
    return tx ?? this.prisma;
  }
}

const PRODUCT_RECORD_SELECT = {
  id: true,
  name: true,
  brand: true,
  category: true,
  normalizationTypeId: true,
  normalizedKey: true,
} satisfies Prisma.ProductSelect;
