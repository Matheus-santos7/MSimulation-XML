import type { VendaMlReturnNoteDestinatario } from "@msimulation-xml/fiscal-core";
import type { FiscalEmitterSettingsData } from "../../../fiscal-settings/domain/services/fiscal-emitter-settings-defaults.js";
import type { CustomerType, ResolvedTaxRule } from "../../../tax/index.js";

/**
 * Regras fiscais e configurações resolvidas uma vez por emissão da cadeia.
 *
 * - `saleTaxRule` — CFOP/impostos da NF-e VENDA (emitente → consumidor)
 * - `inboundTaxRule` — CFOP/impostos do RETORNO SIMBÓLICO (emitente → CD/remessa)
 * - `emitterSettings` — parâmetros do emissor (autXML, etc.)
 */
export type SalesChainRules = {
  saleTaxRule: ResolvedTaxRule;
  inboundTaxRule: ResolvedTaxRule;
  customerType: CustomerType;
  emitterSettings: FiscalEmitterSettingsData;
};

/**
 * NF-e de retorno simbólico criada na cadeia, com referência à remessa FIFO.
 *
 * O campo `destinatario` traz os dados do CD operador logístico (mesmo CD da
 * remessa FIFO), que serão replicados no `<infCpl>` da NF-e VENDA pareada
 * para evidenciar a triangulação fiscal **remessa → retorno → venda**.
 */
export type ReturnNoteCreated = {
  id: string;
  chave: string;
  remessaChave: string;
  numero: number;
  serie: number;
  emitidaEm: Date;
  destinatario: VendaMlReturnNoteDestinatario;
};

/**
 * Resultado completo da {@link SalesChainOrchestrator}.
 *
 * `venda` / `retorno` / `cteVenda` são DTOs mapeados para API; `alocacoes` registra consumo FIFO.
 */
export type SalesChainResult = {
  venda: unknown;
  retorno: unknown;
  cteVenda: unknown;
  alocacoes: unknown;
};
