-- Desconto e frete por linha de pedido (vai para <vDesc>/<vFrete> em <prod> da NF-e)
ALTER TABLE "pedidos" ADD COLUMN "desconto" DECIMAL(15, 2) NOT NULL DEFAULT 0;
ALTER TABLE "pedidos" ADD COLUMN "frete" DECIMAL(15, 2) NOT NULL DEFAULT 0;
