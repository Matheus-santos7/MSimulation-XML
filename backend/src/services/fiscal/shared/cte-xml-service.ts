/**
 * XML autorizado do CT-e: geração na emissão, backfill legado e leitura via API.
 */
import {
  buildCTeXML,
  fiscalXmlDownloadFilename,
  participanteRemetenteFromTenant,
  resolveCteDocumento,
  type CteFiscalPayload,
  type CteVinculo,
} from "@msimulation-xml/fiscal-core";
import type { CTe, NFe, Prisma, PrismaClient, Tenant } from "../../../generated/prisma/client.js";
import type { PrismaTx } from "../../../lib/db/prisma-tx.js";
import {
  montarDadosCteFromNfe,
  type DadosCteEmissao,
} from "../../../lib/fiscal/cte-emissao.js";

export type CteXmlPersistTx = PrismaTx;

export type CteXmlResult = {
  xml: string;
  filename: string;
  source: "stored" | "regenerated";
};

type CteWithNfe = CTe & {
  nfeRemessa?: NFe | null;
  nfeVenda?: NFe | null;
  tenant?: Tenant;
};

function buildCteXmlFromDados(dados: DadosCteEmissao, tenant: Tenant): string {
  return buildCTeXML({
    chave: dados.chave,
    numero: dados.numero,
    serie: dados.serie,
    cfop: dados.cfop,
    natOp: dados.natOp,
    valor: dados.valor,
    valorCarga: dados.valorCarga,
    pesoCarga: dados.pesoCarga,
    status: dados.status,
    emitidoEm: dados.emitidoEm.toISOString(),
    fiscalPayload: dados.fiscalPayload,
    remetenteFallback: participanteRemetenteFromTenant({
      cnpj: tenant.cnpj,
      ie: tenant.ie,
      razaoSocial: tenant.razaoSocial,
      logradouro: tenant.logradouro,
      numero: tenant.numero,
      bairro: tenant.bairro,
      codigoMunicipio: tenant.codigoMunicipio,
      municipio: tenant.municipio,
      uf: tenant.uf,
      cep: tenant.cep,
    }),
  });
}

export function buildCteXmlAutorizado(dados: DadosCteEmissao, tenant: Tenant): string {
  return buildCteXmlFromDados(dados, tenant);
}

export async function persistCteXmlAutorizado(
  tx: CteXmlPersistTx,
  cteId: string,
  dados: DadosCteEmissao,
  tenant: Tenant,
): Promise<string> {
  const xml = buildCteXmlAutorizado(dados, tenant);
  await tx.cTe.update({
    where: { id: cteId },
    data: { xmlAutorizado: xml },
  });
  return xml;
}

/** Reconstrói fiscalPayload (e metadados) para CT-es emitidos antes da refatoração. */
export async function backfillCteLegado(
  prisma: PrismaTx,
  row: CteWithNfe,
): Promise<DadosCteEmissao | null> {
  const nfe = row.nfeRemessa ?? row.nfeVenda;
  const tenant = row.tenant;
  if (!nfe || !tenant) return null;

  const vinculo: CteVinculo = row.nfeVendaId ? "venda" : "remessa";
  const fiscalPayloadExistente = row.fiscalPayload as CteFiscalPayload | null;

  if (fiscalPayloadExistente?.nfeChaveRef && fiscalPayloadExistente.destinatario) {
    const { cfop, natOp } = resolveCteDocumento(vinculo, nfe.destIndIeDest);
    return {
      chave: row.chave,
      numero: row.numero,
      serie: row.serie,
      cfop: row.cfop || cfop,
      natOp: row.natOp || natOp,
      modal: row.modal,
      origem: row.origem,
      destino: row.destino,
      valor: Number(row.valor),
      valorCarga: Number(row.valorCarga),
      pesoCarga: Number(row.pesoCarga),
      status: row.status,
      emitidoEm: row.emitidoEm,
      fiscalPayload: fiscalPayloadExistente,
      nfeRemessaId: row.nfeRemessaId ?? undefined,
      nfeVendaId: row.nfeVendaId ?? undefined,
    };
  }

  const dados = await montarDadosCteFromNfe(prisma, tenant, nfe, vinculo, {
    serie: row.serie,
    numero: row.numero,
    emitidoEm: row.emitidoEm,
  });

  await prisma.cTe.update({
    where: { id: row.id },
    data: {
      fiscalPayload: dados.fiscalPayload as Prisma.InputJsonValue,
      cfop: dados.cfop,
      natOp: dados.natOp,
      origem: dados.origem,
      destino: dados.destino,
      valor: dados.valor,
      valorCarga: dados.valorCarga,
      pesoCarga: dados.pesoCarga,
    },
  });

  return { ...dados, chave: row.chave };
}

function dadosFromPersistedRow(row: CteWithNfe, fiscalPayload: CteFiscalPayload): DadosCteEmissao {
  return {
    chave: row.chave,
    numero: row.numero,
    serie: row.serie,
    cfop: row.cfop,
    natOp: row.natOp,
    modal: row.modal,
    origem: row.origem,
    destino: row.destino,
    valor: Number(row.valor),
    valorCarga: Number(row.valorCarga),
    pesoCarga: Number(row.pesoCarga),
    status: row.status,
    emitidoEm: row.emitidoEm,
    fiscalPayload,
    nfeRemessaId: row.nfeRemessaId ?? undefined,
    nfeVendaId: row.nfeVendaId ?? undefined,
  };
}

export async function resolveCteXml(
  prisma: PrismaClient,
  tenantId: string,
  chave: string,
): Promise<CteXmlResult | null> {
  const row = await prisma.cTe.findFirst({
    where: { chave, tenantId, deletedAt: null },
    include: {
      tenant: true,
      nfeRemessa: true,
      nfeVenda: true,
    },
  });
  if (!row || !row.tenant) return null;

  const filename = fiscalXmlDownloadFilename("CTe", chave);
  const stored = row.xmlAutorizado?.trim();
  if (stored) {
    return { xml: stored, filename, source: "stored" };
  }

  let dados: DadosCteEmissao | null = null;
  const fp = row.fiscalPayload as CteFiscalPayload | null;
  if (fp?.nfeChaveRef && fp.destinatario) {
    dados = dadosFromPersistedRow(row, fp);
  } else {
    dados = await backfillCteLegado(prisma, row);
  }

  if (!dados) return null;

  const xml = buildCteXmlAutorizado(dados, row.tenant);
  await prisma.cTe.update({
    where: { id: row.id },
    data: { xmlAutorizado: xml },
  });

  return { xml, filename, source: "regenerated" };
}

export async function persistCteFromEmission(
  tx: CteXmlPersistTx,
  args: {
    cteId: string;
    tenant: Tenant;
    dados: DadosCteEmissao;
  },
): Promise<void> {
  await persistCteXmlAutorizado(tx, args.cteId, args.dados, args.tenant);
}
