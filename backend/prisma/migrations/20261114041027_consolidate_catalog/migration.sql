/*
  Consolidacao do catalogo (D-002, D-004, D-005, D-018, D-019, D-020, D-050..D-054).

  Parte do banco baseline (0_init): Product (Id, Name, Brand, Category) e
  SellerProduct (Id, SellerName, ProductId, SellerProductId). Passos, na ordem:

  1. Cria Seller a partir dos SellerName distintos do vinculo original.
  2. Recria SellerProduct mantendo os ids: sellerId do Seller, externalId =
     CAST(SellerProductId AS TEXT) (D-020), matchedBy = 'legacy' e name/brand/category
     copiados do Product (a tabela original nao guarda os dados do seller).
  3. Adiciona Product.NormalizedKey, ainda nulo.
  4. Backfill de NormalizedKey, com a mesma normalizacao do ProductNormalizerService (D-019).
  5. Une as duplicatas: canonico = menor Id; vinculos redirecionados ao canonico; vinculo
     repetido (mesmo seller e produto) fica o de menor Id; produtos duplicados removidos.
  6. Torna NormalizedKey obrigatorio (recria Product, mantendo ids e sqlite_sequence) e cria
     os indices unicos.

  CreatedAt/UpdatedAt dos registros existentes recebem CURRENT_TIMESTAMP (D-053).
  O arquivo e propositalmente so ASCII: os caracteres acentuados sao escritos com char(N).
*/

-- Guarda o contador de ids dos autoincrementos: recriar a tabela o reduziria ao maior id
-- restante, e ids ja usados poderiam ser reaproveitados.
CREATE TABLE "_MigrationSequence" (
    "TableName" TEXT NOT NULL PRIMARY KEY,
    "Seq" INTEGER NOT NULL
);
INSERT INTO "_MigrationSequence" ("TableName", "Seq")
SELECT "name", "seq" FROM "sqlite_sequence" WHERE "name" IN ('Product', 'SellerProduct');

-- Passo 1: Seller
CREATE TABLE "Seller" (
    "Id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "SellerName" TEXT NOT NULL,
    "CreatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" DATETIME NOT NULL
);
INSERT INTO "Seller" ("SellerName", "CreatedAt", "UpdatedAt")
SELECT "SellerName", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "SellerProduct"
GROUP BY "SellerName"
ORDER BY MIN("Id");

-- Passo 2: recria SellerProduct (sem os indices unicos, que so entram no passo 6)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SellerProduct" (
    "Id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ProductId" INTEGER NOT NULL,
    "SellerId" INTEGER NOT NULL,
    "ExternalId" TEXT,
    "Name" TEXT NOT NULL,
    "Brand" TEXT,
    "Category" TEXT,
    "MatchedBy" TEXT NOT NULL,
    "CreatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" DATETIME NOT NULL,
    CONSTRAINT "SellerProduct_ProductId_fkey" FOREIGN KEY ("ProductId") REFERENCES "Product" ("Id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SellerProduct_SellerId_fkey" FOREIGN KEY ("SellerId") REFERENCES "Seller" ("Id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SellerProduct" ("Id", "ProductId", "SellerId", "ExternalId", "Name", "Brand", "Category", "MatchedBy", "CreatedAt", "UpdatedAt")
SELECT sp."Id", sp."ProductId", s."Id", CAST(sp."SellerProductId" AS TEXT), p."Name", p."Brand", p."Category", 'legacy', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "SellerProduct" sp
JOIN "Seller" s ON s."SellerName" = sp."SellerName"
JOIN "Product" p ON p."Id" = sp."ProductId"
ORDER BY sp."Id";
DROP TABLE "SellerProduct";
ALTER TABLE "new_SellerProduct" RENAME TO "SellerProduct";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Passo 3: NormalizedKey nulo
ALTER TABLE "Product" ADD COLUMN "NormalizedKey" TEXT;

-- Passo 4: backfill. Cada produto vira duas linhas de trabalho (0 = marca, 1 = nome), para a
-- expressao de normalizacao existir uma unica vez. Ordem: remove acentos (o lower() do SQLite so
-- converte ASCII), lower(), remove " e ', troca espacos em branco por espaco, junta espacos
-- repetidos (10 passadas, ate 1024 espacos seguidos) e trim.
--
-- Letras acentuadas trocadas (Latin-1 Supplement e Latin Extended-A, como NFD + remocao de \p{M}):
--   A: U+00C0 U+00C1 U+00C2 U+00C3 U+00C4 U+00C5 U+0100 U+0102 U+0104
--   C: U+00C7 U+0106 U+0108 U+010A U+010C
--   E: U+00C8 U+00C9 U+00CA U+00CB U+0112 U+0114 U+0116 U+0118 U+011A
--   I: U+00CC U+00CD U+00CE U+00CF U+0128 U+012A U+012C U+012E U+0130
--   N: U+00D1 U+0143 U+0145 U+0147
--   O: U+00D2 U+00D3 U+00D4 U+00D5 U+00D6 U+014C U+014E U+0150
--   U: U+00D9 U+00DA U+00DB U+00DC U+0168 U+016A U+016C U+016E U+0170 U+0172
--   Y: U+00DD U+0176 U+0178
--   a: U+00E0 U+00E1 U+00E2 U+00E3 U+00E4 U+00E5 U+0101 U+0103 U+0105
--   c: U+00E7 U+0107 U+0109 U+010B U+010D
--   e: U+00E8 U+00E9 U+00EA U+00EB U+0113 U+0115 U+0117 U+0119 U+011B
--   i: U+00EC U+00ED U+00EE U+00EF U+0129 U+012B U+012D U+012F
--   n: U+00F1 U+0144 U+0146 U+0148
--   o: U+00F2 U+00F3 U+00F4 U+00F5 U+00F6 U+014D U+014F U+0151
--   u: U+00F9 U+00FA U+00FB U+00FC U+0169 U+016B U+016D U+016F U+0171 U+0173
--   y: U+00FD U+00FF U+0177
--   D: U+010E
--   d: U+010F
--   G: U+011C U+011E U+0120 U+0122
--   g: U+011D U+011F U+0121 U+0123
--   H: U+0124
--   h: U+0125
--   J: U+0134
--   j: U+0135
--   K: U+0136
--   k: U+0137
--   L: U+0139 U+013B U+013D
--   l: U+013A U+013C U+013E
--   R: U+0154 U+0156 U+0158
--   r: U+0155 U+0157 U+0159
--   S: U+015A U+015C U+015E U+0160
--   s: U+015B U+015D U+015F U+0161
--   T: U+0162 U+0164
--   t: U+0163 U+0165
--   W: U+0174
--   w: U+0175
--   Z: U+0179 U+017B U+017D
--   z: U+017A U+017C U+017E
-- Maiusculas sem decomposicao NFD, convertidas para minuscula como o toLowerCase() do JS:
--   U+00C6->U+00E6 U+00D0->U+00F0 U+00D8->U+00F8 U+00DE->U+00FE U+0110->U+0111 U+0126->U+0127 U+0132->U+0133 U+013F->U+0140 U+0141->U+0142 U+014A->U+014B U+0152->U+0153 U+0166->U+0167
CREATE TABLE "_NormalizationWork" (
    "ProductId" INTEGER NOT NULL,
    "Part" INTEGER NOT NULL,
    "Txt" TEXT NOT NULL,
    PRIMARY KEY ("ProductId", "Part")
);
INSERT INTO "_NormalizationWork" ("ProductId", "Part", "Txt")
SELECT "Id", 0, coalesce("Brand", '') FROM "Product"
UNION ALL
SELECT "Id", 1, "Name" FROM "Product";
UPDATE "_NormalizationWork" SET "Txt" = trim(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace("Txt", char(192), 'A'), char(193), 'A'), char(194), 'A'), char(195), 'A'), char(196), 'A'), char(197), 'A'), char(256), 'A'), char(258), 'A'), char(260), 'A'), char(199), 'C'), char(262), 'C'), char(264), 'C'), char(266), 'C'), char(268), 'C'), char(200), 'E'), char(201), 'E'), char(202), 'E'), char(203), 'E'), char(274), 'E'), char(276), 'E'), char(278), 'E'), char(280), 'E'), char(282), 'E'), char(204), 'I'), char(205), 'I'), char(206), 'I'), char(207), 'I'), char(296), 'I'), char(298), 'I'), char(300), 'I'), char(302), 'I'), char(304), 'I'), char(209), 'N'), char(323), 'N'), char(325), 'N'), char(327), 'N'), char(210), 'O'), char(211), 'O'), char(212), 'O'), char(213), 'O'), char(214), 'O'), char(332), 'O'), char(334), 'O'), char(336), 'O'), char(217), 'U'), char(218), 'U'), char(219), 'U'), char(220), 'U'), char(360), 'U'), char(362), 'U'), char(364), 'U'), char(366), 'U'), char(368), 'U'), char(370), 'U'), char(221), 'Y'), char(374), 'Y'), char(376), 'Y'), char(224), 'a'), char(225), 'a'), char(226), 'a'), char(227), 'a'), char(228), 'a'), char(229), 'a'), char(257), 'a'), char(259), 'a'), char(261), 'a'), char(231), 'c'), char(263), 'c'), char(265), 'c'), char(267), 'c'), char(269), 'c'), char(232), 'e'), char(233), 'e'), char(234), 'e'), char(235), 'e'), char(275), 'e'), char(277), 'e'), char(279), 'e'), char(281), 'e'), char(283), 'e'), char(236), 'i'), char(237), 'i'), char(238), 'i'), char(239), 'i'), char(297), 'i'), char(299), 'i'), char(301), 'i'), char(303), 'i'), char(241), 'n'), char(324), 'n'), char(326), 'n'), char(328), 'n'), char(242), 'o'), char(243), 'o'), char(244), 'o'), char(245), 'o'), char(246), 'o'), char(333), 'o'), char(335), 'o'), char(337), 'o'), char(249), 'u'), char(250), 'u'), char(251), 'u'), char(252), 'u'), char(361), 'u'), char(363), 'u'), char(365), 'u'), char(367), 'u'), char(369), 'u'), char(371), 'u'), char(253), 'y'), char(255), 'y'), char(375), 'y'), char(270), 'D'), char(271), 'd'), char(284), 'G'), char(286), 'G'), char(288), 'G'), char(290), 'G'), char(285), 'g'), char(287), 'g'), char(289), 'g'), char(291), 'g'), char(292), 'H'), char(293), 'h'), char(308), 'J'), char(309), 'j'), char(310), 'K'), char(311), 'k'), char(313), 'L'), char(315), 'L'), char(317), 'L'), char(314), 'l'), char(316), 'l'), char(318), 'l'), char(340), 'R'), char(342), 'R'), char(344), 'R'), char(341), 'r'), char(343), 'r'), char(345), 'r'), char(346), 'S'), char(348), 'S'), char(350), 'S'), char(352), 'S'), char(347), 's'), char(349), 's'), char(351), 's'), char(353), 's'), char(354), 'T'), char(356), 'T'), char(355), 't'), char(357), 't'), char(372), 'W'), char(373), 'w'), char(377), 'Z'), char(379), 'Z'), char(381), 'Z'), char(378), 'z'), char(380), 'z'), char(382), 'z')), char(198), char(230)), char(208), char(240)), char(216), char(248)), char(222), char(254)), char(272), char(273)), char(294), char(295)), char(306), char(307)), char(319), char(320)), char(321), char(322)), char(330), char(331)), char(338), char(339)), char(358), char(359)), '"', ''), '''', ''), char(9), ' '), char(10), ' '), char(11), ' '), char(12), ' '), char(13), ' '), char(160), ' '), char(5760), ' '), char(8192), ' '), char(8193), ' '), char(8194), ' '), char(8195), ' '), char(8196), ' '), char(8197), ' '), char(8198), ' '), char(8199), ' '), char(8200), ' '), char(8201), ' '), char(8202), ' '), char(8232), ' '), char(8233), ' '), char(8239), ' '), char(8287), ' '), char(12288), ' '), char(65279), ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' '));
UPDATE "Product" SET "NormalizedKey" =
    (SELECT w."Txt" FROM "_NormalizationWork" w WHERE w."ProductId" = "Product"."Id" AND w."Part" = 0)
    || '|' ||
    (SELECT w."Txt" FROM "_NormalizationWork" w WHERE w."ProductId" = "Product"."Id" AND w."Part" = 1);
DROP TABLE "_NormalizationWork";

-- Passo 5: duplicatas. O canonico de cada chave e o produto de menor Id.
CREATE TABLE "_ProductCanonical" (
    "ProductId" INTEGER NOT NULL PRIMARY KEY,
    "CanonicalId" INTEGER NOT NULL
);
INSERT INTO "_ProductCanonical" ("ProductId", "CanonicalId")
SELECT p."Id", (SELECT MIN(c."Id") FROM "Product" c WHERE c."NormalizedKey" = p."NormalizedKey")
FROM "Product" p
WHERE p."Id" <> (SELECT MIN(c."Id") FROM "Product" c WHERE c."NormalizedKey" = p."NormalizedKey");

-- Vinculos dos duplicados passam a apontar para o canonico.
UPDATE "SellerProduct"
SET "ProductId" = (SELECT m."CanonicalId" FROM "_ProductCanonical" m WHERE m."ProductId" = "SellerProduct"."ProductId")
WHERE "ProductId" IN (SELECT "ProductId" FROM "_ProductCanonical");

-- Mesmo seller e mesmo produto em dois vinculos: fica o de menor Id.
DELETE FROM "SellerProduct"
WHERE "Id" > (
    SELECT MIN(o."Id") FROM "SellerProduct" o
    WHERE o."ProductId" = "SellerProduct"."ProductId" AND o."SellerId" = "SellerProduct"."SellerId"
);

-- Mesmo seller e mesmo externalId em produtos diferentes: o de menor Id mantem o codigo e os
-- demais ficam sem codigo (D-054). No banco atual, nenhuma linha cai aqui.
UPDATE "SellerProduct"
SET "ExternalId" = NULL
WHERE "ExternalId" IS NOT NULL AND "Id" > (
    SELECT MIN(o."Id") FROM "SellerProduct" o
    WHERE o."SellerId" = "SellerProduct"."SellerId" AND o."ExternalId" = "SellerProduct"."ExternalId"
);

-- Produtos duplicados, ja sem vinculos, sao removidos.
DELETE FROM "Product" WHERE "Id" IN (SELECT "ProductId" FROM "_ProductCanonical");
DROP TABLE "_ProductCanonical";

-- Passo 6: NormalizedKey obrigatorio e indices unicos
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "Id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "Name" TEXT NOT NULL,
    "Brand" TEXT,
    "Category" TEXT,
    "NormalizedKey" TEXT NOT NULL,
    "CreatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Product" ("Id", "Name", "Brand", "Category", "NormalizedKey", "CreatedAt", "UpdatedAt")
SELECT "Id", "Name", "Brand", "Category", "NormalizedKey", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Product" ORDER BY "Id";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_NormalizedKey_key" ON "Product"("NormalizedKey");
CREATE UNIQUE INDEX "SellerProduct_ProductId_SellerId_key" ON "SellerProduct"("ProductId", "SellerId");
CREATE UNIQUE INDEX "SellerProduct_SellerId_ExternalId_key" ON "SellerProduct"("SellerId", "ExternalId");
CREATE UNIQUE INDEX "Seller_SellerName_key" ON "Seller"("SellerName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Restaura o contador de ids (nunca reaproveita um id ja usado).
UPDATE "sqlite_sequence"
SET "seq" = max("seq", (SELECT m."Seq" FROM "_MigrationSequence" m WHERE m."TableName" = "sqlite_sequence"."name"))
WHERE "name" IN (SELECT "TableName" FROM "_MigrationSequence");
INSERT INTO "sqlite_sequence" ("name", "seq")
SELECT m."TableName", m."Seq" FROM "_MigrationSequence" m
WHERE m."TableName" NOT IN (SELECT "name" FROM "sqlite_sequence");
DROP TABLE "_MigrationSequence";
