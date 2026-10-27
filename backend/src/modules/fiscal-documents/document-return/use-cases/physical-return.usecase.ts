/**
 * Retorno físico (RETORNO_FISICO): a mercadoria volta do CD ao seller referenciando a remessa
 * com saldo, que é consumido.
 */
import { Injectable } from "@nestjs/common";
import { FiscalStatus, NFeTipo, Prisma } from "../../../../generated/prisma/client.js";
import { runFiscalTransaction } from "../../../../lib/db/prisma-tx.js";
import { mapNfe, num } from "../../shared/fiscal-document.mapper.js";
import { buildChaveNFe } from "../../nfe/rules/nfe-chave.js";
import { proximoNumeroNfe } from "../../nfe/rules/nfe-sequencia.js";
import { enrichTaxSnapshot, loadEmitterSettings } from "../../../fiscal-settings/index.js";
import {
  enrichFiscalPayloadWithXTexto,
  resolveNumeroInicialNfe,
} from "@msimulation-xml/fiscal-core";
import { taxSnapshotFromRule } from "../../../tax/index.js";
import { calcularNotaFiscal } from "../../../tax/index.js";
import { buildFiscalItem, resolveTaxRule, resolveIcmsFallbackRate } from "../../../tax/index.js";
import { persistNfeXmlFromEmission } from "../../nfe/xml/nfe-xml.service.js";
import {
  debitRemessaBalanceByNfeId,
  getNetRemessaNfeBalance,
  prepareRemessaFifoForOperation,
  SaldoRemessaInsuficienteError,
} from "../../../remessas/index.js";
import { DocumentReturnError } from "../../errors/fiscal-documents.errors.js";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import type {
  ProcessPhysicalReturnInput,
  ProcessPhysicalReturnResult,
} from "../../shared/lifecycle-input.types.js";

import {
  resolveDestIeForOperadorLogistico,
  resolveRetornoFisicoCfop,
} from "../rules/return-fiscal.rules.js";

@Injectable()
export class PhysicalReturnUseCase {
  private get db() {
    return getDbClient();
  }

  async execute(input: ProcessPhysicalReturnInput): Promise<ProcessPhysicalReturnResult> {
    const { tenantId, remessaNfeKey } = input;

    const remessa = await this.db.nFe.findFirst({
      where: { chave: remessaNfeKey, tenantId },
      include: {
        tenant: true,
        product: true,
        unidadeDestino: { select: { ie: true, idCadIntTran: true } },
      },
    });

    if (!remessa || remessa.deletedAt) {
      throw new DocumentReturnError("NF-e de remessa não encontrada.", 404);
    }
    if (remessa.tipo !== NFeTipo.REMESSA && remessa.tipo !== NFeTipo.REMESSA_AVANCO) {
      throw new DocumentReturnError(
        "Retorno físico só pode referenciar remessa ou remessa avanço.",
        422,
      );
    }
    if (!remessa.product) {
      throw new DocumentReturnError("Remessa sem produto vinculado.", 422);
    }

    const existing = await this.db.nFe.findFirst({
      where: {
        tipo: NFeTipo.RETORNO_FISICO,
        nfeReferenciaId: remessa.id,
        deletedAt: null,
      },
      select: { numero: true, serie: true },
    });
    if (existing) {
      throw new DocumentReturnError(
        `Esta remessa já possui retorno físico (NF-e ${existing.numero}/${existing.serie}).`,
        409,
      );
    }

    const quantityHeader = remessa.saldoDisponivel ?? remessa.quantidade;
    if (quantityHeader <= 0) {
      throw new DocumentReturnError("Remessa sem saldo disponível para retorno físico.", 422);
    }

    const tenant = remessa.tenant;
    const product = remessa.product;
    const series = tenant.serieRemessa;
    const destUf = remessa.destUf;
    const cfop = resolveRetornoFisicoCfop(tenant.uf, destUf);
    const natOp = "Outras Entradas - Retorno fisico de Deposito Temporario";
    const totalValue = num(remessa.valor);
    const unitValue = remessa.quantidade > 0 ? totalValue / remessa.quantidade : totalValue;

    return runFiscalTransaction(this.db, tenantId, async (tx) => {
      await prepareRemessaFifoForOperation(
        tx as unknown as Parameters<typeof prepareRemessaFifoForOperation>[0],
        tenant.id,
        product.id,
        product.sku ?? undefined,
      );
      const quantity = await getNetRemessaNfeBalance(tx, remessa.id, remessa.quantidade);
      if (quantity <= 0) {
        throw new DocumentReturnError("Remessa sem saldo disponível para retorno físico.", 422);
      }
      const lineValue = unitValue * quantity;

      const emitterSettings = await loadEmitterSettings(tx, tenant.id, remessa.marketplace);
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
          // Tributação de entrada no CD (mesmo canal "remessa" / fullfilmentEntrada).
          operationTipo: "RETORNO_FISICO",
        },
        icmsFallbackRate,
      );
      const invoice = calcularNotaFiscal([fiscalItem]);
      const valorIcms = invoice.totais.vICMS;

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

      const destIe = await resolveDestIeForOperadorLogistico(tx, {
        marketplace: remessa.marketplace,
        fiscalPayload: remessa.fiscalPayload,
        destDoc: remessa.destDoc,
        unidadeDestino: remessa.unidadeDestino,
      });
      const taxSnapshot = enrichTaxSnapshot(
        taxSnapshotFromRule(inboundTaxRule, icmsFallbackRate, emitterSettings),
        {
          settings: emitterSettings,
          tipo: NFeTipo.RETORNO_FISICO,
          valor: lineValue,
          valorIcms,
          emitUf: tenant.uf,
          destUf,
          indFinal: 0,
        },
      );

      const row = await tx.nFe.create({
        data: {
          tenantId: tenant.id,
          marketplace: remessa.marketplace,
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
          valorIcms,
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
              ...taxSnapshot,
              engine: invoice,
              ...(destIe ? { destIe } : {}),
            } as Record<string, unknown>,
            {
              tipo: NFeTipo.RETORNO_FISICO,
              cfop,
              natOp,
              pedidoMl: remessa.pedidoMl,
            },
          ) as Prisma.InputJsonValue,
        },
      });

      try {
        await debitRemessaBalanceByNfeId(
          tx,
          tenant.id,
          remessa.id,
          product.id,
          quantity,
          row.id,
          product.sku ?? undefined,
        );
      } catch (error) {
        if (error instanceof SaldoRemessaInsuficienteError) {
          throw new DocumentReturnError(error.message, 422);
        }
        throw error;
      }

      const saldoRestante = await getNetRemessaNfeBalance(tx, remessa.id, remessa.quantidade);
      await tx.nFe.update({
        where: { id: remessa.id },
        data: { saldoDisponivel: saldoRestante },
      });

      await persistNfeXmlFromEmission(tx, {
        nfeId: row.id,
        tenant,
        productId: product.id,
        settings: emitterSettings,
        nfeReferenciaChave: remessa.chave,
      });

      return {
        retornoFisico: mapNfe(row, remessa.chave) as Record<string, unknown>,
        saldoConsumido: { remessaNfeId: remessa.id, quantidade: quantity },
      };
    });
  }
}
