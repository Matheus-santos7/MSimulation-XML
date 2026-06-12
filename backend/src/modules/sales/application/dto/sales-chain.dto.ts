import type { FiscalEmitterSettingsData } from "../../../../lib/fiscal/fiscal-emitter-settings-defaults.js";
import type { CustomerType, ResolvedTaxRule } from "../../../tax/index.js";

export type SalesChainRules = {
  saleTaxRule: ResolvedTaxRule;
  inboundTaxRule: ResolvedTaxRule;
  customerType: CustomerType;
  emitterSettings: FiscalEmitterSettingsData;
};

export type ReturnNoteCreated = {
  id: string;
  chave: string;
  remessaChave: string;
};

export type SalesChainResult = {
  venda: unknown;
  retorno: unknown;
  cteVenda: unknown;
  alocacoes: unknown;
};
