-- Preço de custo para NF-e de remessa; preço de venda permanece em preco
ALTER TABLE "products" ADD COLUMN "preco_custo" DECIMAL(15, 8) NOT NULL DEFAULT 0;

UPDATE "products" SET "preco_custo" = "preco" WHERE "preco_custo" = 0;
