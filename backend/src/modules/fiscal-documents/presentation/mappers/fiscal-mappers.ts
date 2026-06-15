import { formatNfeDateTime } from "@msimulation-xml/fiscal-core";
import type { CteModal, FiscalStatus, NFeTipo, PrismaClient, Product, TimelineStatus } from "../../../../generated/prisma/client.js";
import { mapProduct } from "../../../catalog/index.js";

export function num(n: { toString(): string } | number): number {
  return typeof n === "number" ? n : Number(n);
}

type NfeRow = {
  id: string;
  tenantId: string;
  productId?: string | null;
  chave: string;
  numero: number;
  serie: number;
  natOp: string;
  cfop: string;
  ncm: string;
  destNome: string;
  destDoc: string;
  destUf: string;
  destLogradouro: string;
  destNumero: string;
  destComplemento: string | null;
  destBairro: string;
  destCodigoMunicipio: string;
  destMunicipio: string;
  destCep: string;
  destCodigoPais: number;
  destNomePais: string;
  destTelefone: string | null;
  destIndIeDest: number;
  valor: { toString(): string };
  valorIcms: { toString(): string };
  aliqIcms: { toString(): string };
  status: FiscalStatus;
  emitidaEm: Date;
  pedidoMl: string;
  quantidade: number;
  tipo: NFeTipo;
  saldoDisponivel?: number | null;
  nfeReferenciaId?: string | null;
  fiscalPayload?: unknown;
};

type NfeItemRow = {
  id: string;
  productId: string;
  numeroItem: number;
  quantidade: number;
  valor: { toString(): string };
  valorIcms: { toString(): string };
  ncm: string;
  cfop: string;
  saldoDisponivel?: number | null;
  product?: Product;
};

export function mapNfeItem(row: NfeItemRow) {
  return {
    id: row.id,
    productId: row.productId,
    numeroItem: row.numeroItem,
    quantidade: row.quantidade,
    valor: num(row.valor),
    valorICMS: num(row.valorIcms),
    ncm: row.ncm,
    cfop: row.cfop,
    saldoDisponivel: row.saldoDisponivel ?? undefined,
    product: row.product ? mapProduct(row.product) : undefined,
  };
}

function saldoRemessaFromItens(
  itens?: NfeItemRow[],
  headerSaldo?: number | null,
  saldoOverride?: number,
): number | undefined {
  if (saldoOverride != null) return saldoOverride;
  if (itens && itens.length > 0) {
    return itens.reduce((acc, item) => acc + (item.saldoDisponivel ?? 0), 0);
  }
  return headerSaldo ?? undefined;
}

export function mapNfe(
  row: NfeRow,
  nfeReferenciaChave?: string,
  itens?: NfeItemRow[],
  saldoFifoOverride?: number,
) {
  const doc = row.destDoc.replace(/\D/g, "");
  const mappedItens = itens?.map(mapNfeItem);
  return {
    id: row.id,
    tenantId: row.tenantId,
    productId: row.productId ?? undefined,
    chave: row.chave,
    numero: row.numero,
    serie: row.serie,
    natOp: row.natOp,
    cfop: row.cfop,
    ncm: row.ncm,
    destinatario: {
      nome: row.destNome,
      doc: row.destDoc,
      uf: row.destUf,
      indIEDest: row.destIndIeDest,
      endereco: {
        logradouro: row.destLogradouro,
        numero: row.destNumero,
        complemento: row.destComplemento ?? undefined,
        bairro: row.destBairro,
        codigoMunicipio: row.destCodigoMunicipio,
        municipio: row.destMunicipio,
        uf: row.destUf,
        cep: row.destCep,
        codigoPais: row.destCodigoPais,
        nomePais: row.destNomePais,
        telefone: row.destTelefone ?? undefined,
      },
      docTipo: doc.length === 14 ? ("CNPJ" as const) : ("CPF" as const),
    },
    valor: num(row.valor),
    valorICMS: num(row.valorIcms),
    aliqICMS: num(row.aliqIcms),
    status: row.status,
    emitidaEm: formatNfeDateTime(row.emitidaEm),
    pedidoML: row.pedidoMl,
    quantidade: row.quantidade,
    tipo: row.tipo,
    saldoDisponivel:
      row.tipo === "REMESSA" || row.tipo === "REMESSA_SIMBOLICA"
        ? saldoRemessaFromItens(itens, row.saldoDisponivel, saldoFifoOverride)
        : undefined,
    itens: mappedItens,
    nfeReferenciaChave: nfeReferenciaChave ?? undefined,
    fiscalPayload: (row.fiscalPayload as Record<string, unknown> | undefined) ?? undefined,
  };
}

const NFE_TIPO_LABEL: Record<NFeTipo, string> = {
  VENDA: "Venda",
  REMESSA: "Remessa",
  RETORNO_SIMBOLICO: "Retorno simbólico",
  DEVOLUCAO: "Devolução",
  REMESSA_SIMBOLICA: "Remessa simbólica",
  TRANSFERENCIA_FILIAL: "Transferência filial",
};

export function labelNfeTipo(tipo: NFeTipo): string {
  return NFE_TIPO_LABEL[tipo];
}

const CTE_MODAL_LABEL: Record<CteModal, string> = {
  RODOVIARIO: "Rodoviário",
  AEREO: "Aéreo",
};

type CteRow = {
  id: string;
  tenantId: string;
  chave: string;
  numero: number;
  serie: number;
  cfop: string;
  natOp: string;
  modal: CteModal;
  origem: string;
  destino: string;
  valor: { toString(): string };
  valorCarga: { toString(): string };
  pesoCarga: { toString(): string };
  status: FiscalStatus;
  emitidoEm: Date;
  fiscalPayload?: unknown;
  nfeRemessaId?: string | null;
  nfeVendaId?: string | null;
  nfeRemessa?: { chave: string } | null;
  nfeVenda?: { chave: string } | null;
};

function resolveCteNfeChaveRef(row: CteRow): string | undefined {
  const fp = row.fiscalPayload as { nfeChaveRef?: string } | null | undefined;
  if (typeof fp?.nfeChaveRef === "string" && fp.nfeChaveRef.length === 44) {
    return fp.nfeChaveRef;
  }
  return row.nfeRemessa?.chave ?? row.nfeVenda?.chave ?? undefined;
}

export function mapCte(row: CteRow) {
  const nfeChaveRef = resolveCteNfeChaveRef(row);
  const fp = row.fiscalPayload as Record<string, unknown> | null | undefined;
  const icms = fp?.icms as { pICMS?: number; vICMS?: number } | undefined;

  return {
    id: row.id,
    tenantId: row.tenantId,
    chave: row.chave,
    numero: row.numero,
    serie: row.serie,
    cfop: row.cfop,
    natOp: row.natOp,
    modal: CTE_MODAL_LABEL[row.modal],
    origem: row.origem,
    destino: row.destino,
    valor: num(row.valor),
    valorCarga: num(row.valorCarga),
    pesoCarga: num(row.pesoCarga),
    status: row.status,
    emitidoEm: formatNfeDateTime(row.emitidoEm),
    nfeChaveRef,
    fiscalPayload: fp ?? undefined,
    aliqIcms: typeof icms?.pICMS === "number" ? icms.pICMS : undefined,
    valorIcms: typeof icms?.vICMS === "number" ? icms.vICMS : undefined,
    vinculadoRemessa: Boolean(row.nfeRemessaId),
    vinculadoVenda: Boolean(row.nfeVendaId),
  };
}

const TIMELINE_UI: Record<TimelineStatus, "done" | "current" | "pending"> = {
  DONE: "done",
  CURRENT: "current",
  PENDING: "pending",
};

export function mapTimeline(row: {
  label: string;
  status: TimelineStatus;
  at: string | null;
  meta: string | null;
}) {
  return {
    label: row.label,
    status: TIMELINE_UI[row.status],
    at: row.at ?? undefined,
    meta: row.meta ?? undefined,
  };
}

export async function resolveTenantId(
  prisma: PrismaClient,
  tenantId: string | undefined,
): Promise<string> {
  if (tenantId) return tenantId;
  const first = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  if (!first) throw new Error("Nenhum tenant cadastrado. Cadastre uma empresa pelo onboarding ou em Empresas.");
  return first.id;
}
