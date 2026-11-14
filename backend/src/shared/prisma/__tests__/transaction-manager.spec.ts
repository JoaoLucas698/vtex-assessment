import type { Prisma } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from '@shared/prisma/prisma.service';
import { TransactionManager } from '@shared/prisma/transaction-manager';
import { Result } from '@shared/result/result';

describe('TransactionManager', () => {
  let sut: TransactionManager;
  let prisma: DeepMockProxy<PrismaService>;
  let tx: DeepMockProxy<Prisma.TransactionClient>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    tx = mockDeep<Prisma.TransactionClient>();
    // $transaction é sobrecarregado; o cast é necessário só para o mock repassar o callback ao tx.
    prisma.$transaction.mockImplementation(
      (work: (client: Prisma.TransactionClient) => Promise<unknown>) =>
        work(tx),
    );
    sut = new TransactionManager(prisma);
  });

  it('devolve o Result.success do work e passa o tx', async () => {
    const work = jest.fn().mockResolvedValue(Result.success(42));

    const result = await sut.run(work);

    expect(work).toHaveBeenCalledWith(tx);
    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) expect(result.value).toBe(42);
  });

  it('em Result.error força rollback e devolve o mesmo erro sem lançar', async () => {
    const error = { code: 'X', message: 'falhou' };
    let transactionRejected = false;
    prisma.$transaction.mockImplementation(
      async (work: (client: Prisma.TransactionClient) => Promise<unknown>) => {
        try {
          return await work(tx);
        } catch (e) {
          transactionRejected = true; // o Prisma só faz rollback quando o callback rejeita
          throw e;
        }
      },
    );

    const result = await sut.run(() => Promise.resolve(Result.error(error)));

    expect(transactionRejected).toBe(true);
    expect(result.isFailure).toBe(true);
    if (result.isFailure) expect(result.error).toBe(error);
  });

  it('relança erro inesperado do work', async () => {
    await expect(
      sut.run(() => Promise.reject(new Error('banco caiu'))),
    ).rejects.toThrow('banco caiu');
  });
});
