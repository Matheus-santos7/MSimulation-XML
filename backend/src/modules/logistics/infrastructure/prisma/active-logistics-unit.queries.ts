import type { MeliUnidadeLogistica, PrismaClient } from "../../../../generated/prisma/client.js";

/** Active global logistics unit by id (catalog shared across tenants). */
export async function findActiveLogisticsUnitRecord(
  prisma: PrismaClient,
  _tenantId: string,
  unitId: string,
): Promise<MeliUnidadeLogistica | null> {
  return prisma.meliUnidadeLogistica.findFirst({
    where: { id: unitId, ativa: true },
  });
}

/** Active global logistics unit by code (e.g. SP02). */
export async function findActiveLogisticsUnitRecordByCode(
  prisma: PrismaClient,
  code: string,
): Promise<MeliUnidadeLogistica | null> {
  const norm = code.trim().toUpperCase();
  if (!norm) return null;
  return prisma.meliUnidadeLogistica.findFirst({
    where: { codigo: norm, ativa: true },
  });
}
