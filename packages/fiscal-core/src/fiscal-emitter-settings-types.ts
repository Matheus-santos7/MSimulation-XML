export type SettingsMode = "DEFAULT" | "CUSTOM";

export type BaseCalcAction =
  | "INCLUIR_NA_BASE"
  | "SUBTRAIR_DA_BASE"
  | "NAO_SUBTRAIR"
  | "NAO_INCLUIR";

export type DifalCalculo = "PADRAO" | "BASE_DUPLA_COM_ICMS" | "SEM_DIFAL";

export type CstDevolucaoMap = { venda: string; devolucao: string };

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
  };
};
