/**
 * CFOP de retorno simbólico (ML SALE → `symbolic_inbound_return`).
 *
 * Allowlist planilha ML: 1949, 2949, 1904, 1907, 2904, 2907.
 * Prefixo 1 = intraestadual; 2 = interestadual (emitente → CD).
 *
 * Naturezas (tabela CFOP / prática Full):
 * - outras_entradas → 1949 / 2949 (CAT 31 / genérico)
 * - retorno_venda_fora → 1904 / 2904
 * - retorno_deposito → 1907 / 2907 (retorno de remessa a depósito fechado / armazém)
 */

export const ML_SYMBOLIC_INBOUND_RETURN_CFOPS = [
  "1949",
  "2949",
  "1904",
  "1907",
  "2904",
  "2907",
] as const;

export type MlSymbolicInboundReturnCfop = (typeof ML_SYMBOLIC_INBOUND_RETURN_CFOPS)[number];

export type SymbolicReturnNatureza =
  | "outras_entradas"
  | "retorno_venda_fora"
  | "retorno_deposito";

export class SymbolicReturnCfopError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SymbolicReturnCfopError";
  }
}

const NATUREZA_CFOP: Record<
  SymbolicReturnNatureza,
  { intra: MlSymbolicInboundReturnCfop; inter: MlSymbolicInboundReturnCfop }
> = {
  outras_entradas: { intra: "1949", inter: "2949" },
  retorno_venda_fora: { intra: "1904", inter: "2904" },
  retorno_deposito: { intra: "1907", inter: "2907" },
};

export function isMlSymbolicInboundReturnCfop(cfop: string): cfop is MlSymbolicInboundReturnCfop {
  return (ML_SYMBOLIC_INBOUND_RETURN_CFOPS as readonly string[]).includes(cfop.trim());
}

export function assertMlSymbolicInboundReturnCfop(cfop: string): MlSymbolicInboundReturnCfop {
  const c = cfop.trim();
  if (!isMlSymbolicInboundReturnCfop(c)) {
    throw new SymbolicReturnCfopError(
      `CFOP ${c} fora da allowlist ML symbolic_inbound_return (${ML_SYMBOLIC_INBOUND_RETURN_CFOPS.join(", ")})`,
    );
  }
  return c;
}

function normalizeUf(uf: string): string {
  return uf.trim().toUpperCase();
}

/** Infere natureza a partir do CFOP da remessa referenciada (FIFO). */
export function inferSymbolicReturnNaturezaFromRemessaCfop(
  remessaCfop: string | null | undefined,
): SymbolicReturnNatureza | null {
  const c = remessaCfop?.trim() ?? "";
  if (!/^\d{4}$/.test(c)) return null;
  const suffix = c.slice(1);
  // 5905/6905 — remessa depósito fechado / armazém
  if (suffix === "905") return "retorno_deposito";
  // 5904/6904 — remessa venda fora / similar
  if (suffix === "904") return "retorno_venda_fora";
  // 5949/6949 e demais — outras entradas (CAT 31 típico)
  return "outras_entradas";
}

export function normalizeSymbolicReturnNatureza(raw: unknown): SymbolicReturnNatureza {
  if (raw === "retorno_venda_fora" || raw === "retorno_deposito" || raw === "outras_entradas") {
    return raw;
  }
  return "outras_entradas";
}

export type ResolveSymbolicInboundReturnCfopInput = {
  emitUf: string;
  destUf: string;
  /** Override explícito (settings). */
  natureza?: SymbolicReturnNatureza | null;
  /** CFOP da remessa FIFO — usado se `natureza` omitida. */
  remessaCfop?: string | null;
};

export type ResolveSymbolicInboundReturnCfopResult = {
  cfop: MlSymbolicInboundReturnCfop;
  natureza: SymbolicReturnNatureza;
  intraestadual: boolean;
};

/**
 * Resolve CFOP de retorno simbólico: UF define 1xxx/2xxx; natureza escolhe o par na allowlist.
 */
export function resolveSymbolicInboundReturnCfop(
  input: ResolveSymbolicInboundReturnCfopInput,
): ResolveSymbolicInboundReturnCfopResult {
  const emit = normalizeUf(input.emitUf);
  const dest = normalizeUf(input.destUf);
  if (!/^[A-Z]{2}$/.test(emit) || !/^[A-Z]{2}$/.test(dest)) {
    throw new SymbolicReturnCfopError(`UF inválida para retorno simbólico: ${input.emitUf}/${input.destUf}`);
  }

  const intraestadual = emit === dest;
  const natureza =
    input.natureza != null
      ? normalizeSymbolicReturnNatureza(input.natureza)
      : inferSymbolicReturnNaturezaFromRemessaCfop(input.remessaCfop) ?? "outras_entradas";

  const pair = NATUREZA_CFOP[natureza];
  const cfop = assertMlSymbolicInboundReturnCfop(intraestadual ? pair.intra : pair.inter);
  return { cfop, natureza, intraestadual };
}
