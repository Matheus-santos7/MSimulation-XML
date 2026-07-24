/**
 * Saldo lógico e alocação de débito da conferência INBOUND.
 * expected = saldo pai + saldos das filhas POSITIVE (mlProcess).
 */

export type ConferenceBalanceSource = {
  id: string;
  balance: number;
};

export type ConferenceDebitAllocation = {
  id: string;
  qty: number;
};

export function sumLogicalConferenceQty(
  parentBalance: number,
  positiveChildrenBalances: readonly number[],
): number {
  const parent = Math.max(0, parentBalance);
  const children = positiveChildrenBalances.reduce(
    (acc, b) => acc + Math.max(0, b),
    0,
  );
  return parent + children;
}

/**
 * Debita em ordem (pai → filhas POSITIVE). Retorna alocações e quanto faltou.
 */
export function allocateDebitAcrossSources(
  quantity: number,
  sources: readonly ConferenceBalanceSource[],
): { allocations: ConferenceDebitAllocation[]; remaining: number } {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error("Quantidade de débito inválida.");
  }
  let remaining = quantity;
  const allocations: ConferenceDebitAllocation[] = [];
  for (const source of sources) {
    if (remaining <= 0) break;
    const available = Math.max(0, source.balance);
    const take = Math.min(remaining, available);
    if (take <= 0) continue;
    allocations.push({ id: source.id, qty: take });
    remaining -= take;
  }
  return { allocations, remaining };
}

export class ConferenceInsufficientBalanceError extends Error {
  readonly missing: number;
  readonly requested: number;

  constructor(requested: number, missing: number) {
    super(
      `Saldo insuficiente para diferença negativa (${requested}); faltam ${missing} un.`,
    );
    this.name = "ConferenceInsufficientBalanceError";
    this.requested = requested;
    this.missing = missing;
  }
}

export function assertDebitFullyAllocated(
  quantity: number,
  remaining: number,
): void {
  if (remaining > 0) {
    throw new ConferenceInsufficientBalanceError(quantity, remaining);
  }
}

export function assertPedidoMlForConference(
  pedidoMl: string | null | undefined,
): void {
  if (typeof pedidoMl !== "string" || !pedidoMl.trim()) {
    throw new Error(
      "Remessa sem pedidoMl: obrigatório para obsCont (xTexto) das NFs de diferença.",
    );
  }
}
