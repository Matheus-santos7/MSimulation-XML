-- AlterTable
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sujeito_st" BOOLEAN NOT NULL DEFAULT false;
