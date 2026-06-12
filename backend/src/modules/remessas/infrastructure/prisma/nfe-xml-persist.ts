import type { Tenant } from "../../../../generated/prisma/client.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import { loadEmitterSettings } from "../../../fiscal-settings/application/services/fiscal-emitter-runtime.js";
import { persistNfeXmlFromEmission } from "../../../fiscal-documents/infrastructure/xml/nfe-xml-service.js";
import type { PrismaClient } from "../../../../generated/prisma/client.js";

type Db = PrismaClient | PrismaTx;

export async function persistirXmlFromEmission(
  db: Db,
  input: {
    nfeId: string;
    tenant: Tenant;
    productId: string;
    nfeReferenciaChave?: string;
  },
): Promise<void> {
  const settings = await loadEmitterSettings(db, input.tenant.id);
  await persistNfeXmlFromEmission(db, {
    nfeId: input.nfeId,
    tenant: input.tenant,
    productId: input.productId,
    settings,
    nfeReferenciaChave: input.nfeReferenciaChave,
  });
}
