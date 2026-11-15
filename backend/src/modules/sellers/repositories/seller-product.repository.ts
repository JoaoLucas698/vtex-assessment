import { Injectable } from '@nestjs/common';
import type { Prisma, SellerProduct } from '@prisma/client';
import type {
  CreateSellerProductData,
  PaginatedResult,
  PaginationParams,
  SellerDataUpdate,
  SellerProductWithProduct,
} from '@modules/sellers/schemas/seller.types';
import { PrismaService } from '@shared/prisma/prisma.service';

@Injectable()
export class SellerProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  findBySellerAndExternalId(
    sellerId: number,
    externalId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SellerProduct | null> {
    return this.client(tx).sellerProduct.findUnique({
      where: { sellerId_externalId: { sellerId, externalId } },
    });
  }

  findBySellerAndProduct(
    sellerId: number,
    productId: number,
    tx?: Prisma.TransactionClient,
  ): Promise<SellerProduct | null> {
    return this.client(tx).sellerProduct.findUnique({
      where: { productId_sellerId: { productId, sellerId } },
    });
  }

  create(
    data: CreateSellerProductData,
    tx?: Prisma.TransactionClient,
  ): Promise<SellerProduct> {
    return this.client(tx).sellerProduct.create({ data });
  }

  updateSellerData(
    id: number,
    data: SellerDataUpdate,
    tx?: Prisma.TransactionClient,
  ): Promise<SellerProduct> {
    return this.client(tx).sellerProduct.update({
      where: { id },
      data: { name: data.name, brand: data.brand, category: data.category },
    });
  }

  async listBySeller(
    sellerId: number,
    params: PaginationParams,
    tx?: Prisma.TransactionClient,
  ): Promise<PaginatedResult<SellerProductWithProduct>> {
    const client = this.client(tx);
    const [items, total] = await Promise.all([
      client.sellerProduct.findMany({
        where: { sellerId },
        orderBy: { id: 'asc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: {
          product: {
            select: { id: true, name: true, brand: true, category: true },
          },
        },
      }),
      client.sellerProduct.count({ where: { sellerId } }),
    ]);
    return { items, total };
  }

  private client(tx?: Prisma.TransactionClient): Prisma.TransactionClient {
    return tx ?? this.prisma;
  }
}
