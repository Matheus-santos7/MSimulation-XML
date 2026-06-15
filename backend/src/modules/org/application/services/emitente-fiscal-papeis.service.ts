import type { DbClient } from "../../../../lib/db/prisma-tx.js";

/** Garante exclusividade do papel de emitente fiscal entre filiais do tenant. */
export async function aplicarPapelEmitenteFilial(
  db: DbClient,
  tenantId: string,
  filialId: string,
  papeis: { emitenteFiscalPrincipal?: boolean; emitenteFiscalMatriz?: boolean },
): Promise<void> {
  if (papeis.emitenteFiscalPrincipal) {
    await db.tenantFilial.updateMany({
      where: { tenantId, id: { not: filialId }, emitenteFiscalPrincipal: true },
      data: { emitenteFiscalPrincipal: false },
    });
    await db.tenant.update({
      where: { id: tenantId },
      data: { emitenteFiscalPrincipal: false },
    });
  }

  if (papeis.emitenteFiscalMatriz) {
    await db.tenantFilial.updateMany({
      where: { tenantId, id: { not: filialId }, emitenteFiscalMatriz: true },
      data: { emitenteFiscalMatriz: false },
    });
    await db.tenant.update({
      where: { id: tenantId },
      data: { emitenteFiscalMatriz: false },
    });
  }
}

export async function aplicarPapelEmitenteTenant(
  db: DbClient,
  tenantId: string,
  papeis: { emitenteFiscalPrincipal?: boolean; emitenteFiscalMatriz?: boolean },
): Promise<void> {
  if (papeis.emitenteFiscalPrincipal) {
    await db.tenantFilial.updateMany({
      where: { tenantId, emitenteFiscalPrincipal: true },
      data: { emitenteFiscalPrincipal: false },
    });
  }

  if (papeis.emitenteFiscalMatriz) {
    await db.tenantFilial.updateMany({
      where: { tenantId, emitenteFiscalMatriz: true },
      data: { emitenteFiscalMatriz: false },
    });
  }
}
