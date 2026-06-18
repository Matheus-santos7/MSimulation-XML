/**
 * Tipos AST (árvore de objetos) para XML NF-e v4.00.
 *
 * Representam a estrutura serializável — não strings XML nem DTOs da API.
 * Valores monetários e quantidades seguem o padrão do schema (strings formatadas).
 *
 * @module core/nfe-ast.types
 */

import type { XmlObject } from "./xml-serializer.js";

/** Valor monetário ou quantidade no formato do XML (ex.: `"815.86"`, `"1.0000"`). */
export type NfeDecimal = string;

/** Atributo `Id` da `infNFe` (ex.: `NFe` + 44 dígitos da chave). */
export type NfeInfId = `NFe${string}`;

/** Endereço fiscal genérico (emitente ou destinatário). */
export type NfeEndereco = {
  xLgr: string;
  nro: string;
  xCpl?: string;
  xBairro: string;
  cMun: string;
  xMun: string;
  UF: string;
  CEP: string;
  cPais: number;
  xPais: string;
  fone?: string;
};

/** Grupo `<ide>` — identificação da NF-e. */
export type NfeIde = {
  cUF: number;
  cNF: string;
  natOp: string;
  mod: number;
  serie: number;
  nNF: number;
  dhEmi: string;
  dhSaiEnt?: string;
  tpNF: number;
  idDest: number;
  cMunFG: string;
  tpImp: number;
  tpEmis: number;
  cDV: string;
  tpAmb: number;
  finNFe: number;
  indFinal: number;
  indPres: number;
  indIntermed?: number;
  procEmi: number;
  verProc: string;
  NFref?: NfeNfRef | NfeNfRef[];
};

export type NfeNfRef = {
  refNFe: string;
};

/** Grupo `<emit>`. */
export type NfeEmit = {
  CNPJ: string;
  xNome: string;
  xFant?: string;
  enderEmit: NfeEndereco;
  IE: string;
  IEST?: string;
  CRT: number;
};

/** Grupo `<dest>`. */
export type NfeDest = {
  CNPJ?: string;
  CPF?: string;
  xNome: string;
  enderDest: NfeEndereco;
  indIEDest: number;
  IE?: string;
  email?: string;
};

/** Grupo `<autXML>`. */
export type NfeAutXml = {
  CPF?: string;
  CNPJ?: string;
};

/** Grupo `<prod>` do item. */
export type NfeProd = {
  cProd: string;
  cEAN: string;
  xProd: string;
  NCM: string;
  CEST?: string;
  EXTIPI?: string;
  CFOP: string;
  uCom: string;
  qCom: NfeDecimal;
  vUnCom: NfeDecimal;
  vProd: NfeDecimal;
  cEANTrib: string;
  uTrib: string;
  qTrib: NfeDecimal;
  vUnTrib: NfeDecimal;
  vFrete?: NfeDecimal;
  vSeg?: NfeDecimal;
  vDesc?: NfeDecimal;
  vOutro?: NfeDecimal;
  indTot: number;
  xPed?: string;
  nFCI?: string;
};

/** Grupo `<imposto>` — filhos variam por CST/regime (ICMS, IPI, PIS, COFINS, IBSCBS). */
export type NfeImposto = XmlObject;

/** Grupo `<ICMS>` — subgrupo varia por CST/CSOSN (ICMS00, ICMS40, etc.). */
export type NfeIcmsImposto = {
  ICMS: XmlObject;
};

/** Grupo `<IPI>` — IPINT (não tributado) ou IPITrib. */
export type NfeIpiImposto = {
  IPI: {
    cEnq: string;
    IPINT?: { CST: string };
    IPITrib?: XmlObject;
  };
};

/** Par `<PIS>` + `<COFINS>` para composição em `<imposto>`. */
export type NfePisCofinsImposto = {
  pis: { PIS: XmlObject };
  cofins: { COFINS: XmlObject };
};

/** Grupo `<IBSCBS>` (reforma tributária). */
export type NfeIbsCbsImposto = {
  IBSCBS: XmlObject;
};

/** Item `<det>` da NF-e. */
export type NfeDet = {
  "@nItem": string;
  prod: NfeProd;
  imposto: NfeImposto;
  infAdProd?: string;
  vItem?: NfeDecimal;
};

/** Totais `<ICMSTot>`. */
export type NfeIcmsTot = {
  vBC: NfeDecimal;
  vICMS: NfeDecimal;
  vICMSDeson?: NfeDecimal;
  vFCPUFDest?: NfeDecimal;
  vICMSUFDest?: NfeDecimal;
  vICMSUFRemet?: NfeDecimal;
  vFCP?: NfeDecimal;
  vBCST?: NfeDecimal;
  vST?: NfeDecimal;
  vFCPST?: NfeDecimal;
  vFCPSTRet?: NfeDecimal;
  vProd: NfeDecimal;
  vFrete?: NfeDecimal;
  vSeg?: NfeDecimal;
  vDesc?: NfeDecimal;
  vII?: NfeDecimal;
  vIPI?: NfeDecimal;
  vIPIDevol?: NfeDecimal;
  vPIS?: NfeDecimal;
  vCOFINS?: NfeDecimal;
  vOutro?: NfeDecimal;
  vNF: NfeDecimal;
  vTotTrib?: NfeDecimal;
};

/** Grupo `<total>`. */
export type NfeTotal = {
  ICMSTot: NfeIcmsTot;
  IBSCBSTot?: XmlObject;
  ISSQNtot?: XmlObject;
  retTrib?: XmlObject;
};

/** Transportadora `<transporta>`. */
export type NfeTransporta = {
  CNPJ?: string;
  CPF?: string;
  xNome?: string;
  IE?: string;
  xEnder?: string;
  xMun?: string;
  UF?: string;
};

/** Volume `<vol>`. */
export type NfeVol = {
  qVol?: number;
  esp?: string;
  marca?: string;
  nVol?: string;
  pesoL?: NfeDecimal;
  pesoB?: NfeDecimal;
};

/** Grupo `<transp>`. */
export type NfeTransp = {
  modFrete: number | string;
  transporta?: NfeTransporta;
  vol?: NfeVol;
  veicTransp?: XmlObject;
};

/** Cartão no pagamento. */
export type NfeCard = {
  tpIntegra?: string;
  CNPJ?: string;
  tBand?: string;
  cAut?: string;
};

/** Detalhe `<detPag>`. */
export type NfeDetPag = {
  indPag?: number;
  tPag: string;
  vPag: NfeDecimal;
  card?: NfeCard;
};

/** Grupo `<pag>`. */
export type NfePag = {
  detPag: NfeDetPag | NfeDetPag[];
};

/** Intermediador `<infIntermed>`. */
export type NfeInfIntermed = {
  CNPJ: string;
  idCadIntTran: string;
};

/** Observação `<obsCont>`. */
export type NfeObsCont = {
  "@xCampo": string;
  xTexto: string;
};

/** Informações adicionais `<infAdic>`. */
export type NfeInfAdic = {
  infCpl?: string;
  infAdFisco?: string;
  obsCont?: NfeObsCont | NfeObsCont[];
};

/** Responsável técnico `<infRespTec>`. */
export type NfeInfRespTec = {
  CNPJ: string;
  xContato: string;
  email: string;
  fone: string;
  idCSRT?: string;
  hashCSRT?: string;
};

/** Protocolo `<infProt>`. */
export type NfeInfProt = {
  tpAmb: number;
  verAplic: string;
  chNFe: string;
  dhRecbto: string;
  nProt: string;
  digVal: string;
  cStat: number;
  xMotivo: string;
};

/** Protocolo `<protNFe>`. */
export type NfeProtNFe = {
  "@versao": string;
  infProt: NfeInfProt;
};

/**
 * Informações da NF-e `<infNFe>`.
 * Atributos `@Id` e `@versao` são obrigatórios no envelope autorizado.
 */
export type NfeInfNFe = {
  "@Id": NfeInfId;
  "@versao": string;
  ide: NfeIde;
  emit: NfeEmit;
  dest: NfeDest;
  autXML?: NfeAutXml | NfeAutXml[];
  det: NfeDet | NfeDet[];
  total: NfeTotal;
  transp?: NfeTransp;
  cobr?: XmlObject;
  pag?: NfePag;
  infIntermed?: NfeInfIntermed;
  infAdic?: NfeInfAdic;
  infRespTec?: NfeInfRespTec;
  exporta?: XmlObject;
  compra?: XmlObject;
  cana?: XmlObject;
};

/** NF-e assinada `<NFe>`. */
export type NfeEnvelope = {
  infNFe: NfeInfNFe;
  Signature?: XmlObject;
};

/**
 * Processo completo `<nfeProc>` — NF-e + protocolo de autorização.
 * Estrutura raiz típica do XML distribuído pela SEFAZ.
 */
export type NfeProc = {
  "@xmlns": string;
  "@versao": string;
  NFe: NfeEnvelope;
  protNFe: NfeProtNFe;
};

/** Documento AST completo para serialização via `XmlDocument`. */
export type NfeProcDocument = {
  declaration?: { version: string; encoding: string };
  root: {
    nfeProc: NfeProc;
  };
};
