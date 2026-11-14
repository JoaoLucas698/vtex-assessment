import {
  hashFile,
  LegacyDatabase,
  ORIGINAL_DATABASE_PATH,
} from '@test/helpers/legacy-database';

const ORIGINAL_PRODUCT_COUNT = 975;
const ORIGINAL_LAST_ID = 975;

describe('Migration consolidate_catalog no banco fornecido', () => {
  let database: LegacyDatabase;
  const originalHash = hashFile(ORIGINAL_DATABASE_PATH);

  beforeAll(async () => {
    database = LegacyDatabase.create();
    await database.migrate();
  }, 120_000);

  afterAll(async () => {
    await database.cleanup();
  });

  it('mantém os 975 produtos, sem unir nenhum', async () => {
    const prisma = database.client();

    expect(await prisma.product.count()).toBe(ORIGINAL_PRODUCT_COUNT);
    const keys = await prisma.product.findMany({
      select: { normalizedKey: true },
    });
    expect(new Set(keys.map((p) => p.normalizedKey)).size).toBe(
      ORIGINAL_PRODUCT_COUNT,
    );
  });

  it('não cria vínculos nem sellers (a tabela original estava vazia)', async () => {
    const prisma = database.client();

    expect(await prisma.sellerProduct.count()).toBe(0);
    expect(await prisma.seller.count()).toBe(0);
  });

  it('todo vínculo existente tem matchedBy legacy (vale para os 0 vínculos de hoje)', async () => {
    const prisma = database.client();

    const notLegacy = await prisma.sellerProduct.count({
      where: { matchedBy: { not: 'legacy' } },
    });

    expect(notLegacy).toBe(0);
  });

  it('nenhum normalizedKey é nulo ou vazio', async () => {
    const prisma = database.client();

    const blank = await prisma.product.count({
      where: { normalizedKey: '' },
    });

    expect(blank).toBe(0);
  });

  it('preserva os ids originais e os dados do produto', async () => {
    const prisma = database.client();

    const first = await prisma.product.findUniqueOrThrow({ where: { id: 1 } });
    const last = await prisma.product.findUniqueOrThrow({
      where: { id: ORIGINAL_LAST_ID },
    });

    expect(first.name).toBe('Knife Set Professional');
    expect(first.brand).toBe('Wusthof');
    expect(first.category).toBe('Kitchen');
    expect(first.normalizedKey).toBe('wusthof|knife set professional');
    expect(last.id).toBe(ORIGINAL_LAST_ID);
  });

  it('mantém a marca nula dos produtos sem marca e usa a chave com marca vazia', async () => {
    const prisma = database.client();

    const withoutBrand = await prisma.product.count({
      where: { brand: null },
    });
    const keysWithEmptyBrand = await prisma.product.count({
      where: { normalizedKey: { startsWith: '|' } },
    });

    expect(withoutBrand).toBeGreaterThan(0);
    expect(keysWithEmptyBrand).toBeGreaterThanOrEqual(withoutBrand);
  });

  it('preenche createdAt e updatedAt dos produtos existentes', async () => {
    const prisma = database.client();

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: 1 },
    });

    expect(product.createdAt).toBeInstanceOf(Date);
    expect(product.updatedAt).toBeInstanceOf(Date);
  });

  it('não reaproveita ids: o próximo produto recebe o id 976', async () => {
    const prisma = database.client();

    const created = await prisma.product.create({
      data: { name: 'Novo', normalizedKey: '|novo' },
    });

    expect(created.id).toBe(ORIGINAL_LAST_ID + 1);
  });

  it('deixa a integridade das chaves estrangeiras intacta', async () => {
    const prisma = database.client();

    const violations = await prisma.$queryRaw<
      unknown[]
    >`PRAGMA foreign_key_check`;

    expect(violations).toHaveLength(0);
  });

  it('não altera o banco original', () => {
    expect(hashFile(ORIGINAL_DATABASE_PATH)).toBe(originalHash);
  });
});
