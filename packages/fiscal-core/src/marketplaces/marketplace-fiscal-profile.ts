import type { MarketplaceCode } from "./marketplace.js";
import type { MarketplaceOrderIdRules } from "./order-id.js";

/**
 * Perfil fiscal de um marketplace: tudo que muda no XML da NF-e de acordo com o marketplace
 * que intermedeia a operação. Cada marketplace tem uma pasta em `marketplaces/<marketplace>/`
 * com os mesmos arquivos; o perfil junta esses arquivos.
 *
 * O backend e o `nfe-xml` nunca comparam o código do marketplace: leem os campos do perfil.
 */
export interface MarketplaceFiscalProfile {
  code: MarketplaceCode;
  nome: string;
  /** `PENDENTE_CONFIGURACAO`: as regras ainda não são conhecidas e o faturamento é bloqueado. */
  status: MarketplaceProfileStatus;
  /** `<infIntermed>`: CNPJ do intermediador e `idCadIntTran` padrão. */
  intermediador: MarketplaceIntermediador | null;
  /** `<infRespTec>` por tipo de operação. */
  responsavelTecnico: { remessa: NfeInfRespTec | null; venda: NfeInfRespTec | null };
  /** CPFs do `<autXML>` quando a empresa não informou os próprios. */
  autXmlCpfsPadrao: readonly string[];
  /** `<transporta>` padrão por tipo de operação. */
  transportador: { remessa: NfeTransporta | null; venda: NfeTransporta | null };
  /** IBS/CBS padrão quando a regra tributária não informa. */
  ibsCbsPadrao: { remessa: Record<string, unknown> | null; venda: Record<string, unknown> | null };
  /** Campos do `<ide>` que o marketplace define. */
  ide: { verProcVenda: string | null; natOpVenda: string | null };
  /** Formato e geração do id do pedido no marketplace. */
  pedido: MarketplaceOrderIdRules;
  /** Monta os blocos do marketplace no `fiscalPayload` de remessa, retorno e transferência. */
  enrichFulfillmentPayload(
    payload: Record<string, unknown>,
    input: FulfillmentPayloadInput,
  ): Record<string, unknown>;
  /** Monta os blocos do marketplace no `fiscalPayload` da venda. */
  enrichVendaPayload(
    payload: Record<string, unknown>,
    input: VendaPayloadInput,
  ): Record<string, unknown>;
}

export type MarketplaceProfileStatus = "ATIVO" | "PENDENTE_CONFIGURACAO";

export type MarketplaceIntermediador = {
  cnpj: string;
  /** Cadastro do vendedor no intermediador; a empresa pode informar o próprio. */
  idCadIntTranPadrao: string;
};

export type NfeInfRespTec = {
  cnpj: string;
  xContato: string;
  email: string;
  fone: string;
  idCSRT?: string;
  hashCSRT?: string;
};

export type NfeTransporta = {
  cnpj?: string;
  ie?: string;
  xNome: string;
  xEnder?: string;
  xMun?: string;
  uf?: string;
};

export type FulfillmentPayloadInput = {
  quantidadeTotal: number;
  destIe?: string | null;
  idCadIntTran?: string | null;
  /** CPFs do bloco `autXML`; quando omitido, usa os do payload ou o padrão do marketplace. */
  autXmlCpfs?: readonly string[] | null;
  /** Inclui `transporta` + `transp` (remessa física e simbólica outbound). */
  withLogistics?: boolean;
};

/** Destinatário da NF-e de retorno simbólico que faz par com a venda (CD de onde a mercadoria sai). */
export type VendaReturnNoteDestinatario = {
  xNome?: string | null;
  cnpj?: string | null;
  ie?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  codigoMunicipio?: string | null;
  cep?: string | null;
  uf?: string | null;
  pais?: string | null;
};

export type VendaReturnNoteRef = {
  numero: number;
  serie: number;
  emitidaEm: Date | string;
  destinatario?: VendaReturnNoteDestinatario;
};

export type VendaPayloadInput = {
  quantidade: number;
  valorFrete?: number;
  xPed?: string | null;
  nfci?: string | null;
  autXmlCpfs?: readonly string[] | null;
  vTotTrib?: number | null;
  returnNote?: VendaReturnNoteRef | null;
  cardAuthorization?: string | null;
};
