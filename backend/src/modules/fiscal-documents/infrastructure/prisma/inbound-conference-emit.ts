/**
 * Emissão das NFs de diferença POSITIVE / NEGATIVE da conferência INBOUND.
 */

import {
  allocateDebitAcrossSources,
  assertDebitFullyAllocated,
  ConferenceInsufficientBalanceError,
  enrichFiscalPayloadWithXTexto,
  INBOUND_NEGATIVE_DIFFERENCE_NAT_OP,
  INBOUND_POSITIVE_DIFFERENCE_NAT_OP,
  InboundConferenceCfopError,
  ML_PROCESS_INBOUND_NEGATIVE_DIFFERENCE,
  ML_PROCESS_INBOUND_POSITIVE_DIFFERENCE,
  resolveInboundNegativeDifferenceCfop,
  resolveInboundPositiveDifferenceCfop,
  resolveNumeroInicialNfe,
  type ConferenceBalanceSource,
  type FiscalEmitterSettingsData,
} from "@msimulation-xml/fiscal-core";
import {
  FiscalStatus,
  NFeTipo,
  Prisma,
} from "../../../../generated/prisma/client.js";
import { buildChaveNFe } from "../../domain/services/nfe-chave.js";
import { proximoNumeroNfe } from "../../domain/services/nfe-sequencia.js";
import { DocumentReturnError } from "../../domain/errors/document-return.error.js";
import { mapNfe, num } from "../../presentation/mappers/fiscal-mappers.js";
import { enrichTaxSnapshot } from "../../../fiscal-settings/application/services/fiscal-emitter-runtime.js";
import { taxSnapshotFromRule } from "../../../tax/domain/services/tax-snapshot.js";
import { calcularNotaFiscal } from "../../../tax/domain/services/tax-engine.js";
import {
  buildFiscalItem,
  resolveIcmsFallbackRate,
  resolveTaxRule,
} from "../../../tax/index.js";
import { persistNfeXmlFromEmission } from "../xml/nfe-xml-service.js";
import {
  debitRemessaBalanceByNfeId,
  getNetRemessaNfeBalance,
  SaldoRemessaInsuficienteError,
} from "../../../remessas/infrastructure/fifo/remessa-fifo.js";
import type { PositiveChildRef } from "./inbound-conference-balance.js";

export type ConferenceEmitShared = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tenant: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  product: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  remessa: any;
  destUf: string;
  unitValue: number;
  emitterSettings: FiscalEmitterSettingsData;
  series: number;
};

function wrapCfopError(error: unknown): never {
  if (error instanceof InboundConferenceCfopError) {
    throw new DocumentReturnError(error.message, 422);
  }
  throw error;
}

function resolveCfopOrThrow(resolve: () => string): string {
  try {
    return resolve();
  } catch (error) {
    wrapCfopError(error);
  }
}

export async function emitNegativeDifference(
  shared: ConferenceEmitShared,
  args: {
    quantity: number;
    parentBalance: number;
    positiveChildren: PositiveChildRef[];
    negativeCfopOverride?: string | null;
  },
): Promise<Record<string, unknown>> {
  const { tx, tenant, product, remessa, destUf, unitValue, emitterSettings, series } =
    shared;
  const quantity = args.quantity;
  const cfop = resolveCfopOrThrow(() =>
    resolveInboundNegativeDifferenceCfop(
      tenant.uf,
      destUf,
      args.negativeCfopOverride,
    ),
  );
  const natOp = INBOUND_NEGATIVE_DIFFERENCE_NAT_OP;
  const lineValue = unitValue * quantity;
  const inboundTaxRule = await resolveTaxRule(tx, tenant.id, {
    originUf: tenant.uf,
    destinationUf: destUf,
    transactionType: "inbound_return",
    customerType: "taxpayer",
    ruleBaseId: product.taxRuleBaseId?.trim() || undefined,
  });
  const icmsFallbackRate =
    num(remessa.aliqIcms) ||
    resolveIcmsFallbackRate(tenant.uf, destUf, "inbound", emitterSettings);

  const fiscalItem = buildFiscalItem(
    {
      codigo: product.sku ?? product.id,
      descricao: product.nome,
      ncm: product.ncm,
      cfop,
      unidade: product.unidade ?? "UN",
      cest: product.cest ?? undefined,
      ean: product.ean ?? undefined,
      exTipi: product.exTipi ?? undefined,
      origem: product.origem ?? 0,
      quantidade: quantity,
      valorUnitario: unitValue,
    },
    inboundTaxRule,
    {
      ufOrigem: tenant.uf,
      ufDestino: destUf,
      customerType: "taxpayer",
      emitterSettings,
      operationTipo: "RETORNO_FISICO",
    },
    icmsFallbackRate,
  );
  const invoice = calcularNotaFiscal([fiscalItem]);
  const numeroInicial = resolveNumeroInicialNfe(emitterSettings, series, {
    serieRemessa: tenant.serieRemessa,
    serieTransferencia: tenant.serieTransferencia,
  });
  const number = await proximoNumeroNfe(tx, tenant.id, series, numeroInicial);
  const accessKey = buildChaveNFe({
    uf: tenant.uf,
    cnpj: tenant.cnpj,
    serie: series,
    numero: number,
  });

  const row = await tx.nFe.create({
    data: {
      tenantId: tenant.id,
      productId: product.id,
      chave: accessKey,
      numero: number,
      serie: series,
      natOp,
      cfop,
      ncm: product.ncm,
      destNome: remessa.destNome,
      destDoc: remessa.destDoc,
      destUf: remessa.destUf,
      destLogradouro: remessa.destLogradouro,
      destNumero: remessa.destNumero,
      destComplemento: remessa.destComplemento,
      destBairro: remessa.destBairro,
      destCodigoMunicipio: remessa.destCodigoMunicipio,
      destMunicipio: remessa.destMunicipio,
      destCep: remessa.destCep,
      destCodigoPais: remessa.destCodigoPais,
      destNomePais: remessa.destNomePais,
      destTelefone: remessa.destTelefone,
      destIndIeDest: remessa.destIndIeDest,
      valor: lineValue,
      valorIcms: invoice.totais.vICMS,
      aliqIcms: fiscalItem.icms.pICMS || icmsFallbackRate,
      status: FiscalStatus.AUTORIZADA,
      emitidaEm: new Date(),
      pedidoMl: remessa.pedidoMl,
      quantidade: quantity,
      tipo: NFeTipo.RETORNO_FISICO,
      saldoDisponivel: null,
      nfeReferenciaId: remessa.id,
      fiscalPayload: enrichFiscalPayloadWithXTexto(
        {
          ...enrichTaxSnapshot(
            taxSnapshotFromRule(inboundTaxRule, icmsFallbackRate, emitterSettings),
            {
              settings: emitterSettings,
              tipo: NFeTipo.RETORNO_FISICO,
              valor: lineValue,
              valorIcms: invoice.totais.vICMS,
              emitUf: tenant.uf,
              destUf,
              indFinal: 0,
            },
          ),
          engine: invoice,
          mlProcess: ML_PROCESS_INBOUND_NEGATIVE_DIFFERENCE,
        } as Record<string, unknown>,
        {
          tipo: NFeTipo.RETORNO_FISICO,
          cfop,
          natOp,
          pedidoMl: remessa.pedidoMl ?? "",
          mlProcess: ML_PROCESS_INBOUND_NEGATIVE_DIFFERENCE,
        },
      ) as Prisma.InputJsonValue,
    },
  });

  const sources: ConferenceBalanceSource[] = [
    { id: remessa.id, balance: args.parentBalance },
  ];
  for (const child of args.positiveChildren) {
    const childBal = await getNetRemessaNfeBalance(tx, child.id, child.quantidade);
    sources.push({ id: child.id, balance: childBal });
  }
  const { allocations, remaining } = allocateDebitAcrossSources(quantity, sources);
  try {
    assertDebitFullyAllocated(quantity, remaining);
  } catch (error) {
    if (error instanceof ConferenceInsufficientBalanceError) {
      throw new DocumentReturnError(error.message, 422);
    }
    throw error;
  }

  try {
    for (const alloc of allocations) {
      await debitRemessaBalanceByNfeId(
        tx,
        tenant.id,
        alloc.id,
        product.id,
        alloc.qty,
        row.id,
        product.sku ?? undefined,
      );
    }
  } catch (error) {
    if (error instanceof SaldoRemessaInsuficienteError) {
      throw new DocumentReturnError(error.message, 422);
    }
    throw error;
  }

  await persistNfeXmlFromEmission(tx, {
    nfeId: row.id,
    tenant,
    productId: product.id,
    settings: emitterSettings,
    nfeReferenciaChave: remessa.chave,
  });

  return mapNfe(row, remessa.chave) as Record<string, unknown>;
}

export async function emitPositiveDifference(
  shared: ConferenceEmitShared,
  args: {
    quantity: number;
    positiveCfopOverride?: string | null;
  },
): Promise<Record<string, unknown>> {
  const { tx, tenant, product, remessa, destUf, unitValue, emitterSettings, series } =
    shared;
  const quantity = args.quantity;
  const cfop = resolveCfopOrThrow(() =>
    resolveInboundPositiveDifferenceCfop(
      tenant.uf,
      destUf,
      args.positiveCfopOverride,
    ),
  );
  const natOp = INBOUND_POSITIVE_DIFFERENCE_NAT_OP;
  const lineValue = unitValue * quantity;
  const inboundTaxRule = await resolveTaxRule(tx, tenant.id, {
    originUf: tenant.uf,
    destinationUf: destUf,
    transactionType: "inbound",
    customerType: "taxpayer",
    ruleBaseId: product.taxRuleBaseId?.trim() || undefined,
  });
  const icmsFallbackRate =
    num(remessa.aliqIcms) ||
    resolveIcmsFallbackRate(tenant.uf, destUf, "inbound", emitterSettings);

  const fiscalItem = buildFiscalItem(
    {
      codigo: product.sku ?? product.id,
      descricao: product.nome,
      ncm: product.ncm,
      cfop,
      unidade: product.unidade ?? "UN",
      cest: product.cest ?? undefined,
      ean: product.ean ?? undefined,
      exTipi: product.exTipi ?? undefined,
      origem: product.origem ?? 0,
      quantidade: quantity,
      valorUnitario: unitValue,
    },
    inboundTaxRule,
    {
      ufOrigem: tenant.uf,
      ufDestino: destUf,
      customerType: "taxpayer",
      emitterSettings,
      operationTipo: "REMESSA",
    },
    icmsFallbackRate,
  );
  const invoice = calcularNotaFiscal([fiscalItem]);
  const numeroInicial = resolveNumeroInicialNfe(emitterSettings, series, {
    serieRemessa: tenant.serieRemessa,
    serieTransferencia: tenant.serieTransferencia,
  });
  const number = await proximoNumeroNfe(tx, tenant.id, series, numeroInicial);
  const accessKey = buildChaveNFe({
    uf: tenant.uf,
    cnpj: tenant.cnpj,
    serie: series,
    numero: number,
  });

  const row = await tx.nFe.create({
    data: {
      tenantId: tenant.id,
      productId: product.id,
      chave: accessKey,
      numero: number,
      serie: series,
      natOp,
      cfop,
      ncm: product.ncm,
      destNome: remessa.destNome,
      destDoc: remessa.destDoc,
      destUf: remessa.destUf,
      destLogradouro: remessa.destLogradouro,
      destNumero: remessa.destNumero,
      destComplemento: remessa.destComplemento,
      destBairro: remessa.destBairro,
      destCodigoMunicipio: remessa.destCodigoMunicipio,
      destMunicipio: remessa.destMunicipio,
      destCep: remessa.destCep,
      destCodigoPais: remessa.destCodigoPais,
      destNomePais: remessa.destNomePais,
      destTelefone: remessa.destTelefone,
      destIndIeDest: remessa.destIndIeDest,
      valor: lineValue,
      valorIcms: invoice.totais.vICMS,
      aliqIcms: fiscalItem.icms.pICMS || icmsFallbackRate,
      status: FiscalStatus.AUTORIZADA,
      emitidaEm: new Date(),
      pedidoMl: remessa.pedidoMl,
      quantidade: quantity,
      tipo: NFeTipo.REMESSA,
      saldoDisponivel: null,
      unidadeDestinoId: remessa.unidadeDestinoId,
      nfeReferenciaId: remessa.id,
      fiscalPayload: enrichFiscalPayloadWithXTexto(
        {
          ...enrichTaxSnapshot(
            taxSnapshotFromRule(inboundTaxRule, icmsFallbackRate, emitterSettings),
            {
              settings: emitterSettings,
              tipo: NFeTipo.REMESSA,
              valor: lineValue,
              valorIcms: invoice.totais.vICMS,
              emitUf: tenant.uf,
              destUf,
              indFinal: 0,
            },
          ),
          engine: invoice,
          mlProcess: ML_PROCESS_INBOUND_POSITIVE_DIFFERENCE,
        } as Record<string, unknown>,
        {
          tipo: NFeTipo.REMESSA,
          cfop,
          natOp,
          pedidoMl: remessa.pedidoMl ?? "",
          mlProcess: ML_PROCESS_INBOUND_POSITIVE_DIFFERENCE,
        },
      ) as Prisma.InputJsonValue,
    },
  });

  await tx.nfeItem.create({
    data: {
      tenantId: tenant.id,
      nfeId: row.id,
      productId: product.id,
      numeroItem: 1,
      quantidade: quantity,
      valor: invoice.itens[0]?.vProd ?? lineValue,
      valorIcms: invoice.totais.vICMS,
      ncm: product.ncm,
      cfop,
      saldoDisponivel: quantity,
    },
  });

  await persistNfeXmlFromEmission(tx, {
    nfeId: row.id,
    tenant,
    productId: product.id,
    settings: emitterSettings,
    nfeReferenciaChave: remessa.chave,
  });

  return mapNfe(row, remessa.chave) as Record<string, unknown>;
}
