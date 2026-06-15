import type { DbClient } from "../../../../lib/db/prisma-tx.js";

type FiscalRoleIds = {
  emitenteRemessaId?: string | null;
  emitenteTransferenciaId?: string | null;
};

function normalizeEmitenteId(tenantId: string, emitenteId: string | null | undefined): string | null {
  if (emitenteId == null || emitenteId === "" || emitenteId === tenantId) return null;
  return emitenteId;
}

/** Sincroniza flags legadas (`emitenteFiscal*`) a partir dos IDs de papéis fiscais. */
export async function syncEmitenteFiscalFlags(
  db: DbClient,
  tenantId: string,
  roles: FiscalRoleIds,
): Promise<void> {
  const remessaId = normalizeEmitenteId(tenantId, roles.emitenteRemessaId);
  const transferenciaId = normalizeEmitenteId(tenantId, roles.emitenteTransferenciaId);

  await db.tenantFilial.updateMany({
    where: { tenantId },
    data: { emitenteFiscalPrincipal: false, emitenteFiscalMatriz: false },
  });

  await db.tenant.update({
    where: { id: tenantId },
    data: {
      emitenteFiscalPrincipal: remessaId == null,
      emitenteFiscalMatriz: transferenciaId == null,
    },
  });

  if (remessaId) {
    await db.tenantFilial.update({
      where: { id: remessaId },
      data: { emitenteFiscalPrincipal: true },
    });
  }

  if (transferenciaId) {
    await db.tenantFilial.update({
      where: { id: transferenciaId },
      data: { emitenteFiscalMatriz: true },
    });
  }
}

export function normalizeFiscalRoleIds(
  tenantId: string,
  roles: FiscalRoleIds,
): { emitenteRemessaId: string | null; emitenteTransferenciaId: string | null } {
  return {
    emitenteRemessaId: normalizeEmitenteId(tenantId, roles.emitenteRemessaId),
    emitenteTransferenciaId: normalizeEmitenteId(tenantId, roles.emitenteTransferenciaId),
  };
}
