-- Marketplace obrigatório em pedidos e NF-e: todo fluxo de emissão e de criação de pedido
-- grava o marketplace explicitamente, então o default MERCADO_LIVRE da migration
-- 20261022120000_marketplaces sai. Linhas existentes mantêm o valor que já têm.
ALTER TABLE "pedidos" ALTER COLUMN "marketplace" DROP DEFAULT;
ALTER TABLE "nfes" ALTER COLUMN "marketplace" DROP DEFAULT;
