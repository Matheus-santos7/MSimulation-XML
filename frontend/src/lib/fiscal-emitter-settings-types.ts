export type {
  BaseCalcAction,
  ComposicaoLinha,
  ComposicaoTributo,
  CstDevolucaoMap,
  DifalCalculo,
  FiscalEmitterSettingsData,
  SettingsMode,
} from "@msimulation-xml/fiscal-core";

import type { FiscalEmitterSettingsData } from "@msimulation-xml/fiscal-core";

export type FiscalEmitterSettingsView = {
  tenantId: string;
  serieRemessa: number;
  serieCte: number;
  taxRulesCount: number;
  settings: FiscalEmitterSettingsData;
};

export type FiscalEmitterSettingsPatch = {
  basic?: Partial<FiscalEmitterSettingsData["basic"]>;
  taxes?: Partial<FiscalEmitterSettingsData["taxes"]>;
  nfe?: Partial<FiscalEmitterSettingsData["nfe"]>;
  serieRemessa?: number;
  serieCte?: number;
};
