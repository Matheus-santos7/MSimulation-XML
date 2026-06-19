-- Avanço entre CDs deixa de usar REMESSA_SIMBOLICA; pós-devolução permanece REMESSA_SIMBOLICA.
ALTER TYPE "NFeTipo" ADD VALUE IF NOT EXISTS 'REMESSA_AVANCO';
ALTER TYPE "OperacaoFiscalTipo" ADD VALUE IF NOT EXISTS 'REMESSA_AVANCO';

UPDATE "nfes" AS n
SET "tipo" = 'REMESSA_AVANCO'
WHERE n."tipo" = 'REMESSA_SIMBOLICA'
  AND EXISTS (
    SELECT 1
    FROM "nfes" AS ref
    WHERE ref."id" = n."nfe_referencia_id"
      AND ref."tipo" = 'RETORNO_SIMBOLICO'
  );
