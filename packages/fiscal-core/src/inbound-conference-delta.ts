/**
 * Deltas de conferência INBOUND (esperado = saldo FIFO atual; recebido = contagem).
 */

export type ConferenceLineInput = {
  /** Identificador estável do item (nfeItemId / productId). */
  lineId: string;
  expectedQty: number;
  receivedQty: number;
};

export type ConferenceDeltaLine = {
  lineId: string;
  expectedQty: number;
  receivedQty: number;
  /** received − expected */
  delta: number;
  /** |delta| quando ≠ 0 */
  absDelta: number;
  sign: "positive" | "negative" | "none";
};

export type ConferenceDeltaPlan = {
  lines: ConferenceDeltaLine[];
  /** Itens com sobra (delta > 0). */
  positive: ConferenceDeltaLine[];
  /** Itens com falta (delta < 0). */
  negative: ConferenceDeltaLine[];
  hasDifferences: boolean;
};

export class InboundConferenceDeltaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InboundConferenceDeltaError";
  }
}

function assertNonNegFinite(n: number, label: string): number {
  if (!Number.isFinite(n) || n < 0) {
    throw new InboundConferenceDeltaError(`${label} inválido: ${n}`);
  }
  return n;
}

/**
 * Calcula deltas por linha. Quantidades podem ser fracionárias (arredonda comercial a 4 casas? — usa number cru).
 */
export function computeConferenceDeltas(
  lines: readonly ConferenceLineInput[],
): ConferenceDeltaPlan {
  if (lines.length === 0) {
    throw new InboundConferenceDeltaError("Conferência exige ao menos uma linha.");
  }

  const computed: ConferenceDeltaLine[] = lines.map((line) => {
    const expectedQty = assertNonNegFinite(line.expectedQty, "expectedQty");
    const receivedQty = assertNonNegFinite(line.receivedQty, "receivedQty");
    if (!line.lineId?.trim()) {
      throw new InboundConferenceDeltaError("lineId obrigatório.");
    }
    const delta = receivedQty - expectedQty;
    const absDelta = Math.abs(delta);
    const sign: ConferenceDeltaLine["sign"] =
      delta > 0 ? "positive" : delta < 0 ? "negative" : "none";
    return {
      lineId: line.lineId.trim(),
      expectedQty,
      receivedQty,
      delta,
      absDelta,
      sign,
    };
  });

  const positive = computed.filter((l) => l.sign === "positive");
  const negative = computed.filter((l) => l.sign === "negative");

  return {
    lines: computed,
    positive,
    negative,
    hasDifferences: positive.length > 0 || negative.length > 0,
  };
}
