/**
 * Conferência INBOUND — emite NFs POSITIVE/NEGATIVE difference e ajusta FIFO.
 * 1ª fatia: remessa mono-produto (header productId).
 */

import {
  computeConferenceDeltas,
  enrichFiscalPayloadWithXTexto,
  INBOUND_NEGATIVE_DIFFERENCE_NAT_OP,
  INBOUND_POSITIVE_DIFFERENCE_NAT_OP,
  InboundConferenceCfopError,
  InboundConferenceDeltaError,
  isInboundPositiveDifferenceNfe,
  ML_PROCESS_INBOUND_NEGATIVE_DIFFERENCE,
  ML_PROCESS_INBOUND_POSITIVE_DIFFERENCE,
  resolveInboundNegativeDifferenceCfop,
  resolveInboundPositiveDifferenceCfop,
  resolveNumeroInicialNfe,
} from "@msimulation-xml/fiscal-core";
import {
  FiscalStatus,
  NFeTipo,
  Prisma,
} from "../../../../generated/prisma/client.js";
import { runFiscalTransaction } from "../../../../lib/db/prisma-tx.js";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import { buildChaveNFe } from "../../domain/services/nfe-chave.js";
import { proximoNumeroNfe } from "../../domain/services/nfe-sequencia.js";
import { DocumentReturnError } from "../../domain/errors/document-return.error.js";
import { mapNfe, num } from "../../presentation/mappers/fiscal-mappers.js";
import {
  enrichTaxSnapshot,
  loadEmitterSettings,
} from "../../../fiscal-settings/application/services/fiscal-emitter-runtime.js";
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
  prepareRemessaFifoForOperation,
  SaldoRemessaInsuficienteError,
} from "../../../remessas/infrastructure/fifo/remessa-fifo.js";

export type ProcessInboundConferenceInput = {
  tenantId: string;
  remessaNfeKey: string;
  /** Quantidade contada agora (expected = saldo FIFO atual). */
  receivedQty: number;
  positiveCfopOverride?: string | null;
  negativeCfopOverride?: string | null;
};

export type ProcessInboundConferenceResult = {
  expectedQty: number;
  receivedQty: number;
  negative?: Record<string, unknown>;
  positive?: Record<string, unknown>;
  saldoApos: number;
  noop: boolean;
};

export class PrismaInboundConferenceRepository {
  private get db() {
    return getDbClient();
  }

  async processConference(
    input: ProcessInboundConferenceInput,
  ): Promise<ProcessInboundConferenceResult> {
    const { tenantId, remessaNfeKey, receivedQty } = input;

    const remessa = await this.db.nFe.findFirst({
      where: { chave: remessaNfeKey, tenantId },
      include: { tenant: true, product: true },
    });

    if (!remessa || remessa.deletedAt) {
      throw new DocumentReturnError("NF-e de remessa não encontrada.", 404);
    }
    if (remessa.tipo !== NFeTipo.REMESSA && remessa.tipo !== NFeTipo.REMESSA_AVANCO) {
      throw new DocumentReturnError(
        "Conferência só se aplica a remessa ou remessa avanço.",
        422,
      );
    }
    if (!remessa.product) {
      throw new DocumentReturnError("Remessa sem produto vinculado.", 422);
    }

    const tenant = remessa.tenant;
    const product = remessa.product;
    const destUf = remessa.destUf;
    const unitValue =
      remessa.quantidade > 0 ? num(remessa.valor) / remessa.quantidade : num(remessa.valor);

    return runFiscalTransaction(this.db, tenantId, async (tx) => {
      await prepareRemessaFifoForOperation(
        tx as unknown as Parameters<typeof prepareRemessaFifoForOperation>[0],
        tenant.id,
        product.id,
        product.sku ?? undefined,
      );

      const parentBalance = await getNetRemessaNfeBalance(tx, remessa.id, remessa.quantidade);
      // Só filhas de sobra (mlProcess POSITIVE) — não contar avanço/retry/outras remessas referenciadas.
      const referencedRemessas = await tx.nFe.findMany({
        where: {
          tenantId: tenant.id,
          nfeReferenciaId: remessa.id,
          tipo: NFeTipo.REMESSA,
          deletedAt: null,
        },
        select: { id: true, quantidade: true, tipo: true, fiscalPayload: true },
      });
      const positiveChildren = referencedRemessas.filter(isInboundPositiveDifferenceNfe);
      let positiveChildrenBalance = 0;
      for (const child of positiveChildren) {
        positiveChildrenBalance += await getNetRemessaNfeBalance(
          tx,
          child.id,
          child.quantidade,
        );
      }
      // Saldo lógico da cobertura desta remessa (pai + sobras POSITIVE filhas).
      const expectedQty = parentBalance + positiveChildrenBalance;
      let plan;
      try {
        plan = computeConferenceDeltas([
          { lineId: remessa.id, expectedQty, receivedQty },
        ]);
      } catch (error) {
        if (
          error instanceof InboundConferenceDeltaError ||
          error instanceof InboundConferenceCfopError
        ) {
          throw new DocumentReturnError(error.message, 422);
        }
        throw error;
      }

      if (!plan.hasDifferences) {
        return {
          expectedQty,
          receivedQty,
          saldoApos: expectedQty,
          noop: true,
        };
      }

      const emitterSettings = await loadEmitterSettings(tx, tenant.id);
      const series = tenant.serieRemessa;
      let negativeDto: Record<string, unknown> | undefined;
      let positiveDto: Record<string, unknown> | undefined;

      const neg = plan.negative[0];
      if (neg) {
        const quantity = neg.absDelta;
        const cfop = (() => {
          try {
            return resolveInboundNegativeDifferenceCfop(
              tenant.uf,
              destUf,
              input.negativeCfopOverride,
            );
          } catch (error) {
            if (error instanceof InboundConferenceCfopError) {
              throw new DocumentReturnError(error.message, 422);
            }
            throw error;
          }
        })();
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
                pedidoMl: remessa.pedidoMl,
                mlProcess: ML_PROCESS_INBOUND_NEGATIVE_DIFFERENCE,
              },
            ) as Prisma.InputJsonValue,
          },
        });

        try {
          let remaining = quantity;
          const fromParent = Math.min(remaining, parentBalance);
          if (fromParent > 0) {
            await debitRemessaBalanceByNfeId(
              tx,
              tenant.id,
              remessa.id,
              product.id,
              fromParent,
              row.id,
              product.sku ?? undefined,
            );
            remaining -= fromParent;
          }
          if (remaining > 0) {
            for (const child of positiveChildren) {
              if (remaining <= 0) break;
              const childBal = await getNetRemessaNfeBalance(
                tx,
                child.id,
                child.quantidade,
              );
              const take = Math.min(remaining, childBal);
              if (take <= 0) continue;
              await debitRemessaBalanceByNfeId(
                tx,
                tenant.id,
                child.id,
                product.id,
                take,
                row.id,
                product.sku ?? undefined,
              );
              remaining -= take;
            }
          }
          if (remaining > 0) {
            throw new DocumentReturnError(
              `Saldo insuficiente para diferença negativa (${quantity}); faltam ${remaining} un.`,
              422,
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

        negativeDto = mapNfe(row, remessa.chave) as Record<string, unknown>;
      }

      const pos = plan.positive[0];
      if (pos) {
        const quantity = pos.absDelta;
        const cfop = (() => {
          try {
            return resolveInboundPositiveDifferenceCfop(
              tenant.uf,
              destUf,
              input.positiveCfopOverride,
            );
          } catch (error) {
            if (error instanceof InboundConferenceCfopError) {
              throw new DocumentReturnError(error.message, 422);
            }
            throw error;
          }
        })();
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
                pedidoMl: remessa.pedidoMl,
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

        positiveDto = mapNfe(row, remessa.chave) as Record<string, unknown>;
      }

      const parentBalanceAfter = await getNetRemessaNfeBalance(
        tx,
        remessa.id,
        remessa.quantidade,
      );
      const referencedRemessasAfter = await tx.nFe.findMany({
        where: {
          tenantId: tenant.id,
          nfeReferenciaId: remessa.id,
          tipo: NFeTipo.REMESSA,
          deletedAt: null,
        },
        select: { id: true, quantidade: true, tipo: true, fiscalPayload: true },
      });
      const positiveChildrenAfter = referencedRemessasAfter.filter(
        isInboundPositiveDifferenceNfe,
      );
      let positiveBalanceAfter = 0;
      for (const child of positiveChildrenAfter) {
        positiveBalanceAfter += await getNetRemessaNfeBalance(
          tx,
          child.id,
          child.quantidade,
        );
      }
      const saldoApos = parentBalanceAfter + positiveBalanceAfter;

      await tx.nFe.update({
        where: { id: remessa.id },
        data: { saldoDisponivel: parentBalanceAfter },
      });

      return {
        expectedQty,
        receivedQty,
        negative: negativeDto,
        positive: positiveDto,
        saldoApos,
        noop: false,
      };
    });
  }
}
