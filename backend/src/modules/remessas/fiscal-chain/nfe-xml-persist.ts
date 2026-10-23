import type { DbClient } from "../../../lib/db/prisma-tx.js";
import { persistNfeXmlFromEmission } from "../../fiscal-documents/index.js";
import { loadEmitterSettings } from "../../fiscal-settings/index.js";
import type { PersistXmlFromEmissionInput } from "./types/fiscal-chain-note.types.js";

/** Gera e grava o XML autorizado com a configuração efetiva do marketplace da nota. */
export async function persistirXmlFromEmission(
  db: DbClient,
  input: PersistXmlFromEmissionInput,
): Promise<void> {
  const settings = await loadEmitterSettings(db, input.tenant.id, input.marketplace);

  await persistNfeXmlFromEmission(db, {
    nfeId: input.nfeId,
    tenant: input.tenant,
    productId: input.productId,
    settings,
    nfeReferenciaChave: input.nfeReferenciaChave,
  });
}
