import type { NfeNumeracaoSettings } from "./nfe-numeracao.js";

export type SettingsMode = "DEFAULT" | "CUSTOM";

export type BaseCalcAction =
  | "INCLUIR_NA_BASE"
  | "SUBTRAIR_DA_BASE"
  | "NAO_SUBTRAIR"
  | "NAO_INCLUIR";

export type DifalCalculo = "PADRAO" | "BASE_DUPLA_COM_ICMS" | "SEM_DIFAL";

export type CstDevolucaoMap = { venda: string; devolucao: string };

/** Alíquotas ICMS padrão quando a planilha não especifica (fonte secundária). */
export type DefaultIcmsRates = {
  intra: number;
  interSale: number;
  interInbound: number;
};

/** Alíquotas PIS/COFINS padrão quando a planilha não especifica. */
export type DefaultPisCofinsRates = {
  pis: number;
  cofins: number;
};

export type ComposicaoLinha = { venda: BaseCalcAction; remessa: BaseCalcAction };

export type ComposicaoTributo = {
  frete: ComposicaoLinha;
  desconto: ComposicaoLinha;
  icms?: ComposicaoLinha;
  difal?: ComposicaoLinha;
  fcpIcms?: ComposicaoLinha;
  fcpDifal?: ComposicaoLinha;
  ipi?: ComposicaoLinha;
  acrescimoPreco: ComposicaoLinha;
};

export type FiscalEmitterSettingsData = {
  basic: {
    formaFaturamento: "EMISSOR_PROPRIO" | "EMISSOR_ML";
    dadosFiscaisAnunciosOk: boolean;
    dadosFiscaisAnunciosNota?: string;
    /**
     * Perfil do emitente para a árvore de CFOP (`resolveCfopByDecisionTree`).
     * Default: comércio.
     */
    perfilVendedor?: "industria" | "comercio";
    /**
     * Logística padrão da venda no simulador.
     * Full ML → `armazem_geral`; venda de estoque próprio → `estoque_proprio`.
     */
    logisticaPadrao?: "armazem_geral" | "estoque_proprio";
    /** Interestadual ST: 6403 (protocolo) vs 6404 (imposto retido). Default: imposto_retido. */
    stInterestadualMode?: "protocolo" | "imposto_retido";
    /**
     * Natureza do CFOP de retorno simbólico (allowlist ML).
     * Omitido: infere da remessa (5905→1907) ou default `outras_entradas` (1949/2949).
     */
    retornoSimbolicoNatureza?: "outras_entradas" | "retorno_venda_fora" | "retorno_deposito";
  };
  taxes: {
    cstDevolucao: {
      mode: SettingsMode;
      icms: CstDevolucaoMap[];
      pisCofins: CstDevolucaoMap[];
    };
    composicaoBaseCalculo: {
      mode: SettingsMode;
      pisCofins: ComposicaoTributo;
      icms: ComposicaoTributo;
      ipi: ComposicaoTributo;
    };
    calculoDifal: {
      mode: SettingsMode;
      bulk: DifalCalculo;
      porUf: Record<string, DifalCalculo>;
    };
    modalidadeFrete: {
      mode: SettingsMode;
      fullfilmentVendas: string;
      fullfilmentEntrada: string;
      coleta: string;
      flex: string;
      turbo: string;
    };
    emissaoGnre: {
      mode: SettingsMode;
      estadosIeCount: number;
      estadosComIe: string[];
    };
    /** Fallback de alíquotas ICMS quando a regra da planilha não preenche o campo. */
    defaultIcmsRates?: DefaultIcmsRates;
    /** Fallback de alíquotas PIS/COFINS quando a regra da planilha não preenche o campo. */
    defaultPisCofins?: DefaultPisCofinsRates;
  };
  nfe: {
    mensagemNfeOk: boolean;
    mensagemPadrao?: string;
    acrescimoPrecoProduto: boolean;
    freteNoCalculo: boolean;
    prazoCancelamento: { horas: number; naoInformar: boolean };
    acessoExternoContatos: number;
    contatos: { nome: string; email: string }[];
    /** CPFs autorizados a baixar XML (`autXML`) — padrão ML quando vazio. */
    autXmlCpfs?: string[];
    /** Numeração inicial por série lógica (remessa/venda vs transferência filial). */
    numeracao?: NfeNumeracaoSettings;
  };
};
