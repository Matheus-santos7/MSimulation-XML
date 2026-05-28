-- CreateTable
CREATE TABLE "fiscal_emitter_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_emitter_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_emitter_settings_tenant_id_key" ON "fiscal_emitter_settings"("tenant_id");

-- AddForeignKey
ALTER TABLE "fiscal_emitter_settings" ADD CONSTRAINT "fiscal_emitter_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
