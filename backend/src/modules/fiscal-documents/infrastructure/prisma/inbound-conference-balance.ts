/**
 * Saldo lógico de conferência: pai + filhas POSITIVE (mlProcess).
 */

import {
  isInboundPositiveDifferenceNfe,
  sumLogicalConferenceQty,
} from "@msimulation-xml/fiscal-core";
import { NFeTipo } from "../../../../generated/prisma/client.js";
import { getNetRemessaNfeBalance } from "../../../remessas/infrastructure/fifo/remessa-fifo.js";

export type PositiveChildRef = {
  id: string;
  quantidade: number;
  tipo?: string | null;
  fiscalPayload?: unknown;
};

export type LogicalConferenceBalance = {
  parentBalance: number;
  positiveChildren: PositiveChildRef[];
  expectedQty: number;
};

export async function loadLogicalConferenceBalance(
  // Prisma tx — tipagem frouxa para não acoplar ao client gerado.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  args: {
    tenantId: string;
    remessaId: string;
    remessaQuantidade: number;
  },
): Promise<LogicalConferenceBalance> {
  const parentBalance = await getNetRemessaNfeBalance(
    tx,
    args.remessaId,
    args.remessaQuantidade,
  );
  const referencedRemessas = (await tx.nFe.findMany({
    where: {
      tenantId: args.tenantId,
      nfeReferenciaId: args.remessaId,
      tipo: NFeTipo.REMESSA,
      deletedAt: null,
    },
    select: { id: true, quantidade: true, tipo: true, fiscalPayload: true },
  })) as PositiveChildRef[];
  const positiveChildren = referencedRemessas.filter(isInboundPositiveDifferenceNfe);
  const childBalances: number[] = [];
  for (const child of positiveChildren) {
    childBalances.push(await getNetRemessaNfeBalance(tx, child.id, child.quantidade));
  }
  return {
    parentBalance,
    positiveChildren,
    expectedQty: sumLogicalConferenceQty(parentBalance, childBalances),
  };
}
