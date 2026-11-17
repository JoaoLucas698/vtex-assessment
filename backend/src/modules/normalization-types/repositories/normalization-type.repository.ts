import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { NormalizationTypeRecord } from '@modules/normalization-types/schemas/normalization-type.types';
import { PrismaService } from '@shared/prisma/prisma.service';

@Injectable()
export class NormalizationTypeRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Todos os tipos, em ordem de id (a ordem em que foram cadastrados). */
  findAll(tx?: Prisma.TransactionClient): Promise<NormalizationTypeRecord[]> {
    return this.client(tx).normalizationType.findMany({
      orderBy: { id: 'asc' },
      select: NORMALIZATION_TYPE_RECORD_SELECT,
    });
  }

  findByCode(
    code: string,
    tx?: Prisma.TransactionClient,
  ): Promise<NormalizationTypeRecord | null> {
    return this.client(tx).normalizationType.findUnique({
      where: { code },
      select: NORMALIZATION_TYPE_RECORD_SELECT,
    });
  }

  private client(tx?: Prisma.TransactionClient): Prisma.TransactionClient {
    return tx ?? this.prisma;
  }
}

const NORMALIZATION_TYPE_RECORD_SELECT = {
  id: true,
  code: true,
  description: true,
  includesBrand: true,
  includesCategory: true,
} satisfies Prisma.NormalizationTypeSelect;
