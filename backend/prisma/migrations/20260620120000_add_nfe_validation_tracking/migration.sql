-- CreateEnum
CREATE TYPE "NfeValidationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "nfes" ADD COLUMN "status_validacao" "NfeValidationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "mensagem_validacao" TEXT,
ADD COLUMN "erros_validacao" JSONB;
