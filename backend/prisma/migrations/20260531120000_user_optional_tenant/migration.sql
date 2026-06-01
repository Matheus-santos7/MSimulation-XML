-- Permite conta sem empresa até concluir onboarding
ALTER TABLE "users" ALTER COLUMN "tenant_id" DROP NOT NULL;
