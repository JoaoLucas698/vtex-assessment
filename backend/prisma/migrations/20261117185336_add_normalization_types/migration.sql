/*
  Tipos de normalizacao da chave do produto (D-110, D-111).

  Passos, na ordem:

  1. Cria NormalizationType e insere os 3 tipos com ids fixos:
       1 NAME_BRAND           Nome + Marca              (marca sim, categoria nao)
       2 NAME_CATEGORY        Nome + Categoria          (marca nao, categoria sim)
       3 NAME_BRAND_CATEGORY  Nome + Marca + Categoria  (marca sim, categoria sim)
  2. Recria Product com NormalizationTypeId NOT NULL (FK para NormalizationType). Todos os
     produtos existentes recebem o tipo 1 (NAME_BRAND), que e exatamente a regra que gerou as
     chaves atuais (`marca|nome`). Id, NormalizedKey, CreatedAt e UpdatedAt sao mantidos.
  3. Troca o unico de NormalizedKey pelo unico composto (NormalizationTypeId, NormalizedKey)
     e cria um indice simples em NormalizedKey (busca da listagem de produtos).
  4. Confere que nenhum produto sumiu e que nenhuma chave mudou.

  O contador de ids de Product (sqlite_sequence) e preservado: ids ja usados nunca voltam.
  O arquivo e propositalmente so ASCII.
*/

-- Guarda o contador de ids de Product: recriar a tabela o reduziria ao maior id restante.
CREATE TABLE "_MigrationSequence" (
    "TableName" TEXT NOT NULL PRIMARY KEY,
    "Seq" INTEGER NOT NULL
);
INSERT INTO "_MigrationSequence" ("TableName", "Seq")
SELECT "name", "seq" FROM "sqlite_sequence" WHERE "name" = 'Product';

-- Foto das chaves antes da recriacao, para a conferencia do passo 4.
CREATE TABLE "_ProductSnapshot" (
    "Id" INTEGER NOT NULL PRIMARY KEY,
    "NormalizedKey" TEXT NOT NULL
);
INSERT INTO "_ProductSnapshot" ("Id", "NormalizedKey")
SELECT "Id", "NormalizedKey" FROM "Product";

-- Passo 1: NormalizationType com os 3 tipos
CREATE TABLE "NormalizationType" (
    "Id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "Code" TEXT NOT NULL,
    "Description" TEXT NOT NULL,
    "IncludesBrand" BOOLEAN NOT NULL,
    "IncludesCategory" BOOLEAN NOT NULL,
    "CreatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "NormalizationType_Code_key" ON "NormalizationType"("Code");
INSERT INTO "NormalizationType" ("Id", "Code", "Description", "IncludesBrand", "IncludesCategory", "CreatedAt", "UpdatedAt") VALUES
    (1, 'NAME_BRAND', 'Nome + Marca', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (2, 'NAME_CATEGORY', 'Nome + Categoria', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (3, 'NAME_BRAND_CATEGORY', 'Nome + Marca + Categoria', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Passo 2 e 3: recria Product com o tipo, backfill = 1 (NAME_BRAND)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "Id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "Name" TEXT NOT NULL,
    "Brand" TEXT,
    "Category" TEXT,
    "NormalizationTypeId" INTEGER NOT NULL,
    "NormalizedKey" TEXT NOT NULL,
    "CreatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_NormalizationTypeId_fkey" FOREIGN KEY ("NormalizationTypeId") REFERENCES "NormalizationType" ("Id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("Id", "Name", "Brand", "Category", "NormalizationTypeId", "NormalizedKey", "CreatedAt", "UpdatedAt")
SELECT "Id", "Name", "Brand", "Category", 1, "NormalizedKey", "CreatedAt", "UpdatedAt" FROM "Product" ORDER BY "Id";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE INDEX "Product_NormalizedKey_idx" ON "Product"("NormalizedKey");
CREATE UNIQUE INDEX "Product_NormalizationTypeId_NormalizedKey_key" ON "Product"("NormalizationTypeId", "NormalizedKey");
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

-- Passo 4: conferencia. Mesma quantidade de produtos e todo par (Id, NormalizedKey) identico
-- ao de antes. Se falhar, o CHECK aborta a migration (e a transacao dela) com o nome abaixo.
CREATE TEMP TABLE "_MigrationGuard" (
    "ok" INTEGER NOT NULL,
    CONSTRAINT "produtos_ou_chaves_mudaram_na_migration_add_normalization_types" CHECK ("ok" = 1)
);
INSERT INTO "_MigrationGuard" ("ok")
SELECT (SELECT count(*) FROM "Product") = (SELECT count(*) FROM "_ProductSnapshot")
   AND (SELECT count(*) FROM "Product") = (
        SELECT count(*) FROM "Product" p
        JOIN "_ProductSnapshot" s ON s."Id" = p."Id" AND s."NormalizedKey" = p."NormalizedKey"
        WHERE p."NormalizationTypeId" = 1
   );
DROP TABLE "_MigrationGuard";
DROP TABLE "_ProductSnapshot";
