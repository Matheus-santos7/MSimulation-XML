-- IE do destinatário contribuinte (indIEDest=1) no rascunho de pedido
ALTER TABLE "pedidos" ADD COLUMN "dest_ie" VARCHAR(20);
