/**
 * Montagem unificada do CT-e vinculado a NF-e (remessa ou venda).
 * Emitente XML: Ebazar (transportador). Destinatário: destino da mercadoria na NF-e.
 */
import {
  CteModal,
  FiscalStatus,
  type NFe,
  type Prisma,
  type Tenant,
} from "../../../../generated/prisma/client.js";
import {
  buildCteFiscalPayload,
  calcularPesoCarga,
  calcularValorFreteRemessa,
  CTE_ML_EMIT,
  resolveCteDocumento,
  type CteFiscalPayload,
  type CteVinculo,
} from "@msimulation-xml/fiscal-core";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import { buildChaveCTe } from "./cte-chave.js";
import { resolveTaxRule } from "../../../tax/index.js";

export type { CteVinculo };

export type DadosCteEmissao = {
  chave: string;
  numero: number;
  serie: number;
  cfop: string;
  natOp: string;
  modal: CteModal;
  origem: string;
  destino: string;
  valor: number;
  valorCarga: number;
  pesoCarga: number;
  status: FiscalStatus;
  emitidoEm: Date;
  fiscalPayload: CteFiscalPayload;
  nfeRemessaId?: string;
  nfeVendaId?: string;
};

function tenantAsRemetente(tenant: Tenant) {
  return {
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
  };
}

async function resolveTaxRuleForCte(
  prisma: PrismaTx,
  tenant: Tenant,
  nfe: NFe,
  vinculo: CteVinculo,
) {
  if (!nfe.productId) return null;
  const product = await prisma.product.findFirst({
    where: { id: nfe.productId, tenantId: tenant.id },
    select: { taxRuleBaseId: true },
  });
  const ruleBaseId = product?.taxRuleBaseId?.trim();
  if (!ruleBaseId) return null;

  return resolveTaxRule(prisma, tenant.id, {
    originUf: tenant.uf,
    destinationUf: nfe.destUf,
    transactionType: vinculo === "remessa" ? "inbound" : "sale",
    customerType: nfe.destIndIeDest === 9 ? "non_taxpayer" : "taxpayer",
    ruleBaseId,
  });
}

export async function montarDadosCteFromNfe(
  prisma: PrismaTx,
  tenant: Tenant,
  nfe: NFe,
  vinculo: CteVinculo,
  params: { serie: number; numero: number; emitidoEm?: Date },
): Promise<DadosCteEmissao> {
  const taxRule = await resolveTaxRuleForCte(prisma, tenant, nfe, vinculo);
  const { cfop, natOp } = resolveCteDocumento(vinculo, nfe.destIndIeDest);
  const fiscalPayload = buildCteFiscalPayload(nfe, tenantAsRemetente(tenant), { taxRule });
  const valorCarga = Number(nfe.valor);
  const valorFrete = calcularValorFreteRemessa(valorCarga);
  const pesoCarga = calcularPesoCarga(nfe.quantidade);
  const emitidoEm = params.emitidoEm ?? new Date();

  const chave = buildChaveCTe({
    uf: CTE_ML_EMIT.uf,
    cnpj: CTE_ML_EMIT.cnpj,
    serie: params.serie,
    numero: params.numero,
  });

  return {
    chave,
    numero: params.numero,
    serie: params.serie,
    cfop,
    natOp,
    modal: CteModal.RODOVIARIO,
    origem: fiscalPayload.rota.origem,
    destino: fiscalPayload.rota.destino,
    valor: valorFrete,
    valorCarga,
    pesoCarga,
    status: FiscalStatus.AUTORIZADA,
    emitidoEm,
    fiscalPayload,
    ...(vinculo === "remessa" ? { nfeRemessaId: nfe.id } : { nfeVendaId: nfe.id }),
  };
}

export function dadosCteToPrismaCreate(
  tenantId: string,
  dados: DadosCteEmissao,
  xmlAutorizado?: string,
): Prisma.CTeUncheckedCreateInput {
  return {
    tenantId,
    chave: dados.chave,
    numero: dados.numero,
    serie: dados.serie,
    cfop: dados.cfop,
    natOp: dados.natOp,
    modal: dados.modal,
    origem: dados.origem,
    destino: dados.destino,
    valor: dados.valor,
    valorCarga: dados.valorCarga,
    pesoCarga: dados.pesoCarga,
    status: dados.status,
    emitidoEm: dados.emitidoEm,
    fiscalPayload: dados.fiscalPayload as Prisma.InputJsonValue,
    xmlAutorizado: xmlAutorizado ?? null,
    nfeRemessaId: dados.nfeRemessaId,
    nfeVendaId: dados.nfeVendaId,
  };
}
