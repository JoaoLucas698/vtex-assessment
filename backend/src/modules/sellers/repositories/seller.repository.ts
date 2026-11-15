import { Injectable } from '@nestjs/common';
import type { Prisma, Seller } from '@prisma/client';
import type {
  PaginatedResult,
  PaginationParams,
} from '@shared/pagination/pagination.types';
import type { SellerWithProductCount } from '@modules/sellers/schemas/seller.types';
import { PrismaService } from '@shared/prisma/prisma.service';

@Injectable()
export class SellerRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByName(
    sellerName: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Seller | null> {
    return this.client(tx).seller.findUnique({ where: { sellerName } });
  }

  create(sellerName: string, tx?: Prisma.TransactionClient): Promise<Seller> {
    return this.client(tx).seller.create({ data: { sellerName } });
  }

  findById(id: number, tx?: Prisma.TransactionClient): Promise<Seller | null> {
    return this.client(tx).seller.findUnique({ where: { id } });
  }

  async list(
    params: PaginationParams,
    tx?: Prisma.TransactionClient,
  ): Promise<PaginatedResult<SellerWithProductCount>> {
    const client = this.client(tx);
    const [rows, total] = await Promise.all([
      client.seller.findMany({
        orderBy: [{ sellerName: 'asc' }, { id: 'asc' }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: { _count: { select: { sellerProducts: true } } },
      }),
      client.seller.count(),
    ]);
    const items = rows.map(({ _count, ...seller }) => ({
      ...seller,
      productCount: _count.sellerProducts,
    }));
    return { items, total };
  }

  private client(tx?: Prisma.TransactionClient): Prisma.TransactionClient {
    return tx ?? this.prisma;
  }
}
