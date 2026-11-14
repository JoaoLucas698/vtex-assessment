-- CreateTable
CREATE TABLE "Product" (
    "Id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "Name" TEXT NOT NULL,
    "Brand" TEXT,
    "Category" TEXT
);

-- CreateTable
CREATE TABLE "SellerProduct" (
    "Id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "SellerName" TEXT NOT NULL,
    "ProductId" INTEGER NOT NULL,
    "SellerProductId" INTEGER NOT NULL,
    CONSTRAINT "SellerProduct_ProductId_fkey" FOREIGN KEY ("ProductId") REFERENCES "Product" ("Id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
