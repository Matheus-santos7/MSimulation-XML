import { gerarProtocoloSefazSimulado } from "@msimulation-xml/fiscal-core";

/** Protocolo SEFAZ simulado (15 dígitos). */
export function gerarProtocoloSefaz(cOrgao = "41"): string {
  return gerarProtocoloSefazSimulado(cOrgao);
}
