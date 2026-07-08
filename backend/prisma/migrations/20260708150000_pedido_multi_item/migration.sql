-- Multi-item orders: move product lines from pedidos to pedido_itens.

CREATE TABLE "pedido_itens" (
    "id" TEXT NOT NULL,
    "pedido_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "numero_item" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "desconto" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "frete" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedido_itens_pkey" PRIMARY KEY ("id")
);

INSERT INTO "pedido_itens" (
    "id",
    "pedido_id",
    "product_id",
    "numero_item",
    "quantidade",
    "desconto",
    "frete",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid()::text,
    "id",
    "product_id",
    1,
    "quantidade",
    "desconto",
    "frete",
    "created_at",
    "updated_at"
FROM "pedidos";

ALTER TABLE "pedido_itens"
    ADD CONSTRAINT "pedido_itens_pedido_id_fkey"
    FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pedido_itens"
    ADD CONSTRAINT "pedido_itens_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "uq_pedido_item_numero" ON "pedido_itens"("pedido_id", "numero_item");
CREATE INDEX "idx_pedido_item_pedido_id" ON "pedido_itens"("pedido_id");
CREATE INDEX "idx_pedido_item_product_id" ON "pedido_itens"("product_id");

ALTER TABLE "pedidos" DROP CONSTRAINT IF EXISTS "pedidos_product_id_fkey";
ALTER TABLE "pedidos" DROP COLUMN "product_id";
ALTER TABLE "pedidos" DROP COLUMN "quantidade";
ALTER TABLE "pedidos" DROP COLUMN "desconto";
ALTER TABLE "pedidos" DROP COLUMN "frete";
