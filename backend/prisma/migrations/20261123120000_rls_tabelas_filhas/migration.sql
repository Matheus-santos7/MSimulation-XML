-- S-1 da auditoria (2026-11-11): `pedido_itens` e `nfe_remessa_consumos` não têm `tenant_id` e
-- ficavam fora da RLS. A policy herda o isolamento do pai: `pedidos` e `nfes` já têm RLS, então o
-- EXISTS só enxerga o pai do tenant em `app.tenant_id`. Sem coluna nova, backfill ou mudança no código.

ALTER TABLE "pedido_itens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pedido_itens" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "pedido_itens";
CREATE POLICY tenant_isolation ON "pedido_itens" FOR ALL
  USING (EXISTS (SELECT 1 FROM "pedidos" p WHERE p.id = "pedido_itens".pedido_id))
  WITH CHECK (EXISTS (SELECT 1 FROM "pedidos" p WHERE p.id = "pedido_itens".pedido_id));

-- Retorno e remessa são do mesmo tenant; exigir os dois barra referência cruzada na escrita.
ALTER TABLE "nfe_remessa_consumos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "nfe_remessa_consumos" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "nfe_remessa_consumos";
CREATE POLICY tenant_isolation ON "nfe_remessa_consumos" FOR ALL
  USING (
    EXISTS (SELECT 1 FROM "nfes" n WHERE n.id = "nfe_remessa_consumos".retorno_nfe_id)
    AND EXISTS (SELECT 1 FROM "nfes" n WHERE n.id = "nfe_remessa_consumos".remessa_nfe_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM "nfes" n WHERE n.id = "nfe_remessa_consumos".retorno_nfe_id)
    AND EXISTS (SELECT 1 FROM "nfes" n WHERE n.id = "nfe_remessa_consumos".remessa_nfe_id)
  );
