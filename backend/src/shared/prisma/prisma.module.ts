import { Global, Module } from '@nestjs/common';
import { PrismaService } from '@shared/prisma/prisma.service';
import { TransactionManager } from '@shared/prisma/transaction-manager';

@Global()
@Module({
  providers: [PrismaService, TransactionManager],
  exports: [PrismaService, TransactionManager],
})
export class PrismaModule {}
