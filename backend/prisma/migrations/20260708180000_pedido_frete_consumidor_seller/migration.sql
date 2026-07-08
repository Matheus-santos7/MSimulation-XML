-- Frete do pedido: consumidor (NF-e) e seller (complemento no CT-e)
ALTER TABLE "pedido_itens" ADD COLUMN "frete_consumidor" DECIMAL(15, 2) NOT NULL DEFAULT 0;
ALTER TABLE "pedido_itens" ADD COLUMN "frete_seller" DECIMAL(15, 2) NOT NULL DEFAULT 0;

UPDATE "pedido_itens" SET "frete_consumidor" = "frete";

ALTER TABLE "pedido_itens" DROP COLUMN "frete";
