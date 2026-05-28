import type { BaseCalcAction, DifalCalculo } from "./fiscal-emitter-settings-types";

export type FiscalOption = { value: string; label: string };

export const BR_STATES: { uf: string; nome: string }[] = [
  { uf: "AC", nome: "Acre" },
  { uf: "AL", nome: "Alagoas" },
  { uf: "AP", nome: "Amapá" },
  { uf: "AM", nome: "Amazonas" },
  { uf: "BA", nome: "Bahia" },
  { uf: "CE", nome: "Ceará" },
  { uf: "DF", nome: "Distrito Federal" },
  { uf: "ES", nome: "Espírito Santo" },
  { uf: "GO", nome: "Goiás" },
  { uf: "MA", nome: "Maranhão" },
  { uf: "MT", nome: "Mato Grosso" },
  { uf: "MS", nome: "Mato Grosso do Sul" },
  { uf: "MG", nome: "Minas Gerais" },
  { uf: "PA", nome: "Pará" },
  { uf: "PB", nome: "Paraíba" },
  { uf: "PR", nome: "Paraná" },
  { uf: "PE", nome: "Pernambuco" },
  { uf: "PI", nome: "Piauí" },
  { uf: "RJ", nome: "Rio de Janeiro" },
  { uf: "RN", nome: "Rio Grande do Norte" },
  { uf: "RS", nome: "Rio Grande do Sul" },
  { uf: "RO", nome: "Rondônia" },
  { uf: "RR", nome: "Roraima" },
  { uf: "SC", nome: "Santa Catarina" },
  { uf: "SP", nome: "São Paulo" },
  { uf: "SE", nome: "Sergipe" },
  { uf: "TO", nome: "Tocantins" },
];

export const ICMS_CST_VENDA: FiscalOption[] = [
  { value: "102", label: "102 - Tributada pelo Simples Nacional sem permissão de crédito" },
  { value: "103", label: "103 - Isenção do ICMS no Simples Nacional para faixa de receita bruta" },
  { value: "300", label: "300 - Imune" },
  { value: "400", label: "400 - Não tributada pelo Simples Nacional" },
  { value: "500", label: "500 - ICMS cobrado anteriormente por substituição tributária (substituído) ou por antecipação" },
];

export const ICMS_CST_DEVOLUCAO: FiscalOption[] = [
  { value: "41", label: "41 - Não tributada" },
  { value: "60", label: "60 - ICMS cobrado anteriormente por substituição tributária" },
  { value: "90", label: "90 - Outros" },
];

export const PIS_COFINS_CST_VENDA: FiscalOption[] = [
  { value: "01", label: "01 - Operação Tributável com Alíquota Básica" },
  { value: "02", label: "02 - Operação Tributável com Alíquota Diferenciada" },
  { value: "03", label: "03 - Operação Tributável com Alíquota por Unidade de Medida de Produto" },
  { value: "04", label: "04 - Operação Tributável Monofásica - Revenda a Alíquota Zero" },
  { value: "05", label: "05 - Operação Tributável por Substituição Tributária" },
  { value: "06", label: "06 - Operação Tributável a Alíquota Zero" },
  { value: "07", label: "07 - Operação Isenta da Contribuição" },
  { value: "08", label: "08 - Operação sem Incidência da Contribuição" },
  { value: "09", label: "09 - Operação com Suspensão da Contribuição" },
  { value: "49", label: "49 - Outras Operações de Saída" },
  { value: "99", label: "99 - Outras Operações" },
];

export const PIS_COFINS_CST_DEVOLUCAO: FiscalOption[] = [
  { value: "50", label: "50 - Operação com direito a crédito - vinculada exclusivamente a receita tributada no mercado interno" },
  { value: "51", label: "51 - Operação com direito a crédito - vinculada exclusivamente a receita não-tributada no mercado interno" },
  { value: "52", label: "52 - Operação com direito a crédito - vinculada exclusivamente a receita de exportação" },
  { value: "53", label: "53 - Operação com direito a crédito - vinculada a receitas tributadas e não-tributadas no mercado interno" },
  { value: "54", label: "54 - Operação com direito a crédito - vinculada a receitas tributadas no mercado interno e de exportação" },
  { value: "55", label: "55 - Operação com direito a crédito - vinculada a receitas tributadas no mercado interno e de exportação" },
  { value: "56", label: "56 - Operação com direito a crédito - vinculada a receitas tributadas e não-tributadas no mercado interno e de exportação" },
  { value: "60", label: "60 - Crédito presumido - operação de aquisição vinculada exclusivamente a receita tributada no mercado interno" },
  { value: "61", label: "61 - Crédito presumido - operação de aquisição vinculada exclusivamente a receita não-tributada no mercado interno" },
  { value: "62", label: "62 - Crédito presumido - operação de aquisição vinculada exclusivamente a receita de exportação" },
  { value: "63", label: "63 - Crédito presumido - operação de aquisição vinculada a receitas tributadas e não-tributadas no mercado interno" },
  { value: "64", label: "64 - Crédito presumido - operação de aquisição vinculada a receitas tributadas no mercado interno e de exportação" },
  { value: "65", label: "65 - Crédito presumido - operação de aquisição vinculada a receitas tributadas e não-tributadas no mercado interno e de exportação" },
  { value: "66", label: "66 - Crédito presumido - outras operações" },
  { value: "67", label: "67 - Crédito presumido - outras operações" },
  { value: "70", label: "70 - Operação de aquisição sem direito a crédito" },
  { value: "71", label: "71 - Operação de aquisição com isenção" },
  { value: "72", label: "72 - Operação de aquisição com suspensão" },
  { value: "73", label: "73 - Operação de aquisição a alíquota zero" },
  { value: "74", label: "74 - Operação de aquisição sem incidência da contribuição" },
  { value: "75", label: "75 - Operação de aquisição por substituição tributária" },
  { value: "98", label: "98 - Outras operações de entrada" },
  { value: "99", label: "99 - Outras operações" },
];

export const BASE_CALC_ACTIONS: { value: BaseCalcAction; label: string }[] = [
  { value: "INCLUIR_NA_BASE", label: "Incluir na base" },
  { value: "SUBTRAIR_DA_BASE", label: "Subtrair da base" },
  { value: "NAO_SUBTRAIR", label: "Não subtrair" },
  { value: "NAO_INCLUIR", label: "Não incluir" },
];

export const DIFAL_OPCOES: { value: DifalCalculo; label: string }[] = [
  { value: "PADRAO", label: "Padrão" },
  { value: "BASE_DUPLA_COM_ICMS", label: "Base dupla com ICMS" },
  { value: "SEM_DIFAL", label: "Sem DIFAL" },
];

export const MOD_FRETE_OPCOES: FiscalOption[] = [
  { value: "0", label: "0 - Contratação do frete por conta do remetente (CIF)" },
  { value: "1", label: "1 - Contratação do frete por conta do destinatário (FOB)" },
  { value: "2", label: "2 - Contratação do frete por conta de terceiros" },
  { value: "3", label: "3 - Transporte próprio por conta do remetente" },
  { value: "4", label: "4 - Transporte próprio por conta do destinatário" },
  { value: "9", label: "9 - Sem operação de transporte" },
];

export function labelForOption(options: FiscalOption[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

export function labelForDifal(value: DifalCalculo): string {
  return DIFAL_OPCOES.find((o) => o.value === value)?.label ?? value;
}

export function labelForBaseAction(value: BaseCalcAction): string {
  return BASE_CALC_ACTIONS.find((o) => o.value === value)?.label ?? value;
}
