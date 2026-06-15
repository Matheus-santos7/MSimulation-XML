-- Papéis fiscais por ID de estabelecimento (matriz ou filial).

ALTER TABLE "tenants"
  ADD COLUMN "emitente_remessa_id" TEXT,
  ADD COLUMN "emitente_transferencia_id" TEXT;

-- Migra flags legadas: filial com papel → id da filial; senão permanece null (matriz).
UPDATE "tenants" t
SET "emitente_remessa_id" = sub.id
FROM (
  SELECT DISTINCT ON (tf.tenant_id) tf.tenant_id, tf.id
  FROM "tenant_filiais" tf
  WHERE tf.emitente_fiscal_principal = true
  ORDER BY tf.tenant_id, tf.created_at ASC
) sub
WHERE t.id = sub.tenant_id;

UPDATE "tenants" t
SET "emitente_transferencia_id" = sub.id
FROM (
  SELECT DISTINCT ON (tf.tenant_id) tf.tenant_id, tf.id
  FROM "tenant_filiais" tf
  WHERE tf.emitente_fiscal_matriz = true
  ORDER BY tf.tenant_id, tf.created_at ASC
) sub
WHERE t.id = sub.tenant_id;
