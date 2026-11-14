import {
  insertLegacyLink,
  insertLegacyProduct,
  LegacyDatabase,
} from '@test/helpers/legacy-database';

/**
 * O banco fornecido não tem vínculos nem produtos duplicados, então este teste grava dados
 * legados sintéticos ANTES do `migrate deploy` para exercitar a união de duplicatas, o
 * redirecionamento e a remoção de vínculos repetidos (D-018, D-020).
 */
describe('Migration consolidate_catalog com dados legados sintéticos', () => {
  let database: LegacyDatabase;
  const ids: Record<string, number> = {};
  const REAL_PRODUCTS = 975;

  beforeAll(async () => {
    database = LegacyDatabase.create();
    const prisma = database.client();

    // Grupo A: o mesmo produto com espaço duplo, caixa, acento e aspas de polegada.
    ids.a1 = await insertLegacyProduct(prisma, {
      name: 'Super  Phone 12.9"',
      brand: 'Acme',
      category: 'Phones',
    });
    ids.a2 = await insertLegacyProduct(prisma, {
      name: "Super Phone 12.9''",
      brand: 'ACME',
      category: 'Phone',
    });
    ids.a3 = await insertLegacyProduct(prisma, {
      name: 'Super Phone 12.9',
      brand: 'Acmé',
      category: null,
    });
    // Grupo B: acento no nome e espaço sobrando no fim.
    ids.b1 = await insertLegacyProduct(prisma, {
      name: 'Câmera Pro',
      brand: 'Zeta',
      category: 'Photography',
    });
    ids.b2 = await insertLegacyProduct(prisma, {
      name: 'Camera Pro  ',
      brand: 'zeta',
      category: 'Photo',
    });
    // Produto parecido, mas diferente: não pode ser unido.
    ids.c1 = await insertLegacyProduct(prisma, {
      name: 'Camera Max',
      brand: 'Zeta',
      category: 'Photography',
    });
    // Grupo D: marca nula e marca vazia.
    ids.d1 = await insertLegacyProduct(prisma, {
      name: 'Cable Organizer',
      brand: null,
      category: null,
    });
    ids.d2 = await insertLegacyProduct(prisma, {
      name: 'cable  organizer',
      brand: '',
      category: 'Home',
    });

    // L1..L9, nesta ordem (ids 1..9).
    await insertLegacyLink(prisma, {
      sellerName: 'LojaA',
      productId: ids.a1,
      sellerProductId: 101,
    });
    await insertLegacyLink(prisma, {
      sellerName: 'LojaA',
      productId: ids.a2,
      sellerProductId: 102,
    });
    await insertLegacyLink(prisma, {
      sellerName: 'LojaB',
      productId: ids.a3,
      sellerProductId: 103,
    });
    await insertLegacyLink(prisma, {
      sellerName: 'LojaA',
      productId: ids.b1,
      sellerProductId: 104,
    });
    await insertLegacyLink(prisma, {
      sellerName: 'LojaB',
      productId: ids.b2,
      sellerProductId: 105,
    });
    await insertLegacyLink(prisma, {
      sellerName: 'LojaB',
      productId: ids.c1,
      sellerProductId: 106,
    });
    await insertLegacyLink(prisma, {
      sellerName: 'LojaA',
      productId: 1,
      sellerProductId: 107,
    });
    // Mesmo seller e mesmo código (107) em outro produto: o código fica só no primeiro (D-054).
    await insertLegacyLink(prisma, {
      sellerName: 'LojaA',
      productId: ids.d1,
      sellerProductId: 107,
    });

    await database.migrate();
  }, 120_000);

  afterAll(async () => {
    await database.cleanup();
  });

  it('une as duplicatas no produto de menor id e remove os demais', async () => {
    const prisma = database.client();

    const total = await prisma.product.count();
    const remaining = await prisma.product.findMany({
      where: { id: { gte: ids.a1 } },
      orderBy: { id: 'asc' },
      select: { id: true, normalizedKey: true },
    });

    // 8 produtos sintéticos, 4 unidos (a2, a3, b2, d2).
    expect(total).toBe(REAL_PRODUCTS + 8 - 4);
    expect(remaining).toEqual([
      { id: ids.a1, normalizedKey: 'acme|super phone 12.9' },
      { id: ids.b1, normalizedKey: 'zeta|camera pro' },
      { id: ids.c1, normalizedKey: 'zeta|camera max' },
      { id: ids.d1, normalizedKey: '|cable organizer' },
    ]);
  });

  it('cria um seller para cada nome distinto, na ordem do primeiro vínculo', async () => {
    const prisma = database.client();

    const sellers = await prisma.seller.findMany({ orderBy: { id: 'asc' } });

    expect(sellers.map((s) => [s.id, s.sellerName])).toEqual([
      [1, 'LojaA'],
      [2, 'LojaB'],
    ]);
  });

  it('mantém os ids dos vínculos, redireciona ao canônico e remove o vínculo repetido', async () => {
    const prisma = database.client();

    const links = await prisma.sellerProduct.findMany({
      orderBy: { id: 'asc' },
    });

    // Antes: 8 vínculos. L2 (LojaA -> a2, que vira a1) repete L1 e é removido.
    expect(links.map((l) => [l.id, l.sellerId, l.productId])).toEqual([
      [1, 1, ids.a1],
      [3, 2, ids.a1], // redirecionado de a3
      [4, 1, ids.b1],
      [5, 2, ids.b1], // redirecionado de b2
      [6, 2, ids.c1],
      [7, 1, 1],
      [8, 1, ids.d1],
    ]);
  });

  it('grava externalId como o SellerProductId em texto e matchedBy legacy', async () => {
    const prisma = database.client();

    const links = await prisma.sellerProduct.findMany({
      orderBy: { id: 'asc' },
    });

    expect(links.map((l) => l.externalId)).toEqual([
      '101',
      '103',
      '104',
      '105',
      '106',
      '107',
      null, // o código 107 já pertence ao vínculo 7 do mesmo seller (D-054)
    ]);
    expect(links.every((l) => l.matchedBy === 'legacy')).toBe(true);
  });

  it('copia name, brand e category do produto original de cada vínculo, sem o redirecionamento', async () => {
    const prisma = database.client();

    const redirected = await prisma.sellerProduct.findUniqueOrThrow({
      where: { id: 3 },
    });
    const untouched = await prisma.sellerProduct.findUniqueOrThrow({
      where: { id: 7 },
    });

    // O vínculo 3 apontava para a3 ("Acmé" / "Super Phone 12.9" / sem categoria).
    expect(redirected.name).toBe('Super Phone 12.9');
    expect(redirected.brand).toBe('Acmé');
    expect(redirected.category).toBeNull();
    expect(untouched.name).toBe('Knife Set Professional');
    expect(untouched.brand).toBe('Wusthof');
    expect(untouched.category).toBe('Kitchen');
  });

  it('não reaproveita o id do produto removido', async () => {
    const prisma = database.client();

    // d2 era o maior id (removido). O próximo produto precisa passar dele.
    const created = await prisma.product.create({
      data: { name: 'Depois', normalizedKey: '|depois' },
    });

    expect(created.id).toBe(ids.d2 + 1);
  });

  it('não deixa nenhuma chave estrangeira quebrada', async () => {
    const prisma = database.client();

    const violations = await prisma.$queryRaw<
      unknown[]
    >`PRAGMA foreign_key_check`;

    expect(violations).toHaveLength(0);
  });
});
