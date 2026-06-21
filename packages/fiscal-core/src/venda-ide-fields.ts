import { resolveFiscalExitUf } from "./interstate-icms.js";

export type ResolveVendaIdeFieldsInput = {
  /** UF do emitente (`<emit><UF>`). */
  emitUf: string;
  /** Código IBGE do município do emitente. */
  emitCMun: string;
  /** UF de saída física (CD fulfillment), quando diferente da matriz. */
  ufSaidaFisica?: string | null;
  /** Código IBGE do município de saída física (CD). */
  cMunSaidaFisica?: string | null;
};

export type ResolveVendaIdeFieldsResult = {
  /** Código UF para `<ide><cUF>` — sempre UF do emitente (MOC). */
  cUf: string;
  /** Código IBGE para `<ide><cMunFG>` — município do fato gerador do ICMS. */
  cMunFG: string;
};

/**
 * Resolve `cUF` e `cMunFG` da NF-e de venda fulfillment.
 *
 * - `cUF` segue a UF do emitente (alinha com a chave de acesso).
 * - `cMunFG` usa o município do CD quando a saída física ocorre fora da UF da matriz.
 */
export function resolveVendaIdeFields(input: ResolveVendaIdeFieldsInput): ResolveVendaIdeFieldsResult {
  const emitUf = input.emitUf.trim().toUpperCase();
  const stockUf = resolveFiscalExitUf(emitUf, input.ufSaidaFisica);
  const cMunSaida = (input.cMunSaidaFisica ?? "").replace(/\D/g, "").trim();
  const emitCMun = input.emitCMun.replace(/\D/g, "").trim();

  const cMunFG = stockUf !== emitUf && cMunSaida.length === 7 ? cMunSaida : emitCMun;

  return {
    cUf: emitUf,
    cMunFG,
  };
}
