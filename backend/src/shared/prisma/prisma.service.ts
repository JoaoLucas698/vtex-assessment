import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createPrismaAdapter } from '@shared/prisma/create-prisma-adapter';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const url = process.env.DATABASE_URL;
    // Erro de configuração (inesperado): a aplicação não deve subir sem banco.
    if (!url) throw new Error('DATABASE_URL não definida.');
    super({ adapter: createPrismaAdapter(url) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
