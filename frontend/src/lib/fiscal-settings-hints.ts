import type { FiscalEmitterSettingsView } from "./fiscal-emitter-settings-types";
import { labelForDifal, labelForOption, MOD_FRETE_OPCOES } from "./fiscal-settings-constants";

export function cstDevolucaoHint(cfg: FiscalEmitterSettingsView | null): string {
  if (!cfg) return "Configure o mapeamento CST venda → devolução";
  const { icms, pisCofins, mode } = cfg.settings.taxes.cstDevolucao;
  if (mode === "DEFAULT") return "Configuração padrão do emissor";
  return `${icms.length} ICMS · ${pisCofins.length} PIS/COFINS mapeados`;
}

export function composicaoBaseHint(cfg: FiscalEmitterSettingsView | null): string {
  if (!cfg) return "Composição da base de cálculo";
  if (cfg.settings.taxes.composicaoBaseCalculo.mode === "DEFAULT") {
    return "Configuração padrão do emissor";
  }
  return "Venda e remessa configuradas (PIS/COFINS, ICMS, IPI)";
}

export function calculoDifalHint(cfg: FiscalEmitterSettingsView | null): string {
  if (!cfg) return "Cálculo DIFAL por estado";
  const { mode, porUf } = cfg.settings.taxes.calculoDifal;
  if (mode === "DEFAULT") return "Configuração padrão do emissor";
  const custom = Object.entries(porUf).filter(([, v]) => v !== "PADRAO");
  if (custom.length === 0) return "Padrão em todos os estados";
  if (custom.length === 1) {
    const [uf, v] = custom[0]!;
    return `${uf}: ${labelForDifal(v)}`;
  }
  return `${custom.length} estado(s) com configuração diferente do padrão`;
}

export function modalidadeFreteHint(cfg: FiscalEmitterSettingsView | null): string {
  if (!cfg) return "Modalidade de frete nas NF-e";
  const m = cfg.settings.taxes.modalidadeFrete;
  if (m.mode === "DEFAULT") return "Configuração padrão do emissor";
  return `Fulfillment vendas: ${labelForOption(MOD_FRETE_OPCOES, m.fullfilmentVendas).slice(0, 40)}…`;
}

export function prazoCancelamentoHint(cfg: FiscalEmitterSettingsView | null): string {
  if (!cfg) return "Configure o prazo máximo em horas";
  const p = cfg.settings.nfe.prazoCancelamento;
  if (p.naoInformar) return "Prazo não informado";
  return `Prazo máximo de ${p.horas} hora(s) para cancelamento`;
}
