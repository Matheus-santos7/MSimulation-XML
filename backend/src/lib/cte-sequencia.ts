import type { PrismaTx } from "./db/prisma-tx.js";
import { fiscalNotDeleted } from "../services/fiscal/fiscal-service.js";

export async function proximoNumeroCte(
  prisma: PrismaTx,
  tenantId: string,
  serie: number,
): Promise<number> {
  const last = await prisma.cTe.findFirst({
    where: { tenantId, serie, ...fiscalNotDeleted },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });
  return (last?.numero ?? 0) + 1;
}
