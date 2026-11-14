import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/prisma/prisma.service';
import { Result } from '@shared/result/result';

/** Sinal interno que força o rollback do Prisma. Nunca sai do `TransactionManager`. */
class RollbackSignal<E> extends Error {
  constructor(readonly failure: Result<never, E>) {
    super('rollback');
  }
}

export interface TransactionOptions {
  /** Tempo máximo da transação em ms. */
  timeout?: number;
  /** Tempo máximo de espera por uma conexão em ms. */
  maxWait?: number;
}

/** O padrão do Prisma (5 s) é curto para importações grandes. */
export const DEFAULT_TRANSACTION_TIMEOUT_MS = 30_000;

@Injectable()
export class TransactionManager {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Executa `work` numa transação. Se `work` devolver `Result.error`, faz rollback
   * e devolve o mesmo `Result.error`. Erros inesperados são relançados (rollback também).
   */
  async run<T, E>(
    work: (tx: Prisma.TransactionClient) => Promise<Result<T, E>>,
    options: TransactionOptions = {},
  ): Promise<Result<T, E>> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const result = await work(tx);
          if (result.isFailure) throw new RollbackSignal<E>(result);
          return result;
        },
        { timeout: DEFAULT_TRANSACTION_TIMEOUT_MS, ...options },
      );
    } catch (error) {
      if (error instanceof RollbackSignal) return error.failure as Result<T, E>;
      throw error;
    }
  }
}
