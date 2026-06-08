-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MEMBER');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'MEMBER';
ALTER TABLE "users" ADD COLUMN "email_verified_at" TIMESTAMP(3);

-- Primeiro usuário de cada tenant vira ADMIN
UPDATE "users" u
SET "role" = 'ADMIN'
FROM (
  SELECT DISTINCT ON ("tenant_id") "id"
  FROM "users"
  WHERE "tenant_id" IS NOT NULL
  ORDER BY "tenant_id", "created_at" ASC
) first_users
WHERE u."id" = first_users."id";

-- Contas existentes sem verificação explícita permanecem verificadas (compatibilidade)
UPDATE "users" SET "email_verified_at" = "created_at" WHERE "email_verified_at" IS NULL;

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens"("token_hash");
CREATE INDEX "idx_email_verification_user" ON "email_verification_tokens"("user_id");
CREATE INDEX "idx_email_verification_expires" ON "email_verification_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
