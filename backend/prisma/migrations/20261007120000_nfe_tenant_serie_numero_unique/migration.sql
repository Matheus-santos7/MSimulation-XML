-- G3: fecha a condição de corrida de numeração (MAX(numero)+1 sem lock).
-- Número de NF-e é único por tenant+série para sempre: a legislação fiscal
-- não permite reemitir um número mesmo após cancelamento/soft-delete, por
-- isso a constraint cobre todas as linhas (não é filtrada por deleted_at).
--
-- ATENÇÃO antes de aplicar em produção: verificar duplicidades existentes.
-- Se a query abaixo retornar linhas, esta migration falhará — resolva os
-- conflitos (renumeração/inutilização manual) antes do deploy.
--
--   SELECT tenant_id, serie, numero, count(*)
--   FROM nfes
--   GROUP BY tenant_id, serie, numero
--   HAVING count(*) > 1;

ALTER TABLE "nfes" ADD CONSTRAINT "uq_nfe_tenant_serie_numero" UNIQUE ("tenant_id", "serie", "numero");
