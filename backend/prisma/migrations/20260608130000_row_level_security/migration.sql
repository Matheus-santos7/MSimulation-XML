-- Row-Level Security: isolamento multi-tenant em camadas de negócio (defesa em profundidade).
-- Tabelas de autenticação (users, sessions, tokens) ficam fora do RLS — fluxos de login/onboarding.
-- A API define app.tenant_id via set_config antes das queries autenticadas de negócio.

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'tenant_unidades_logisticas',
    'movimentacoes_produto',
    'fiscal_emitter_settings',
    'products',
    'pedidos',
    'nfes',
    'ctes',
    'fiscal_events',
    'nfe_inutilizacoes',
    'audit_logs',
    'timeline_steps',
    'tax_rules'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I FOR ALL USING (tenant_id::text = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id::text = current_setting(''app.tenant_id'', true))',
      tbl
    );
  END LOOP;
END $$;
