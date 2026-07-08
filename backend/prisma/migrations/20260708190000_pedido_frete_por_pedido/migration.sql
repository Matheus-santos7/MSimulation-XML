-- Frete por pedido (não por item): soma valores existentes e move para pedidos.

ALTER TABLE "pedidos" ADD COLUMN "frete_consumidor" DECIMAL(15, 2) NOT NULL DEFAULT 0;
ALTER TABLE "pedidos" ADD COLUMN "frete_seller" DECIMAL(15, 2) NOT NULL DEFAULT 0;

UPDATE "pedidos" p
SET
  "frete_consumidor" = COALESCE((
    SELECT SUM(pi."frete_consumidor") FROM "pedido_itens" pi WHERE pi."pedido_id" = p."id"
  ), 0),
  "frete_seller" = COALESCE((
    SELECT SUM(pi."frete_seller") FROM "pedido_itens" pi WHERE pi."pedido_id" = p."id"
  ), 0);

ALTER TABLE "pedido_itens" DROP COLUMN "frete_consumidor";
ALTER TABLE "pedido_itens" DROP COLUMN "frete_seller";
