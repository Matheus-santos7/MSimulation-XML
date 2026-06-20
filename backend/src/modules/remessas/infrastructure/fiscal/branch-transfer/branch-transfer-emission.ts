import {
  FiscalStatus,
  NFeTipo,
  OperacaoFiscalTipo,
  Prisma,
  type Tenant,
  type TenantFilial,
} from "../../../../../generated/prisma/client.js";
import type { DbClient } from "../../../../../lib/db/prisma-tx.js";
import { runFiscalTransaction } from "../../../../../lib/db/prisma-tx.js";
import { mapNfe } from "../../../../fiscal-documents/presentation/mappers/fiscal-mappers.js";
import { buildChaveNFe } from "../../../../fiscal-documents/domain/services/nfe-chave.js";
import { proximoNumeroNfe } from "../../../../fiscal-documents/domain/services/nfe-sequencia.js";
import {
  enrichTaxSnapshot,
  loadEmitterSettings,
} from "../../../../fiscal-settings/application/services/fiscal-emitter-runtime.js";
import { taxSnapshotFromRule } from "../../../../tax/domain/services/tax-snapshot.js";
import {
  enrichFiscalPayloadMlFulfillment,
  enrichFiscalPayloadWithXTexto,
  resolveNumeroInicialNfe,
  productUnitPrice,
} from "@msimulation-xml/fiscal-core";
import {
  calculateInvoiceTaxes,
  inferIcmsRateForShipment,
  orderLineFromProduct,
  resolveTaxRule,
} from "../../../../tax/index.js";
import { createLogisticsModule } from "../../../../logistics/index.js";
import { persistNfeXmlAutorizado } from "../../../../fiscal-documents/infrastructure/xml/nfe-xml-service.js";
import { mapEmitenteFromFilial } from "../../../../org/infrastructure/fiscal/tenant-emitente.mapper.js";
import {
  chaveEmissaoFromOverride,
  type EmitenteEmissaoOverride,
} from "../../../../org/index.js";
import {
  TRANSFERENCIA_FILIAL_NAT_OP,
  destinoFiscalToNfeFields,
  filialParaDestinoFiscal,
  resolveTransferenciaCfop,
} from "../helpers/transferencia-filial-dest.js";
import { BranchTransferError } from "./branch-transfer.errors.js";
import type { BranchTransferLineInput } from "./branch-transfer.types.js";

/**
 * Emit branch transfer NFe with items.
 *
 * Creates NFe TRANSFERENCIA_FILIAL (CFOP 5152/6152) from matrix to the target branch.
 */
export async function emitBranchTransferNfeWithItems(
  db: DbClient,
  tenant: Tenant,
  filial: TenantFilial,
  linhas: BranchTransferLineInput[],
  pedidoMl: string,
  matrizEmitente: EmitenteEmissaoOverride,
) {
  const destino = filialParaDestinoFiscal(filial);
  const destData = destinoFiscalToNfeFields(destino);
  const matrizUf = matrizEmitente.uf;
  const emitterSettings = await loadEmitterSettings(db, tenant.id);
  const aliqFallback = inferIcmsRateForShipment(matrizUf, destino.uf, emitterSettings);

  const linhasComRegras: {
    line: ReturnType<typeof orderLineFromProduct>;
    rule: NonNullable<Awaited<ReturnType<typeof resolveTaxRule>>>;
  }[] = [];

  for (const [index, linha] of linhas.entries()) {
    const unitCusto = productUnitPrice(linha.product, "REMESSA");
    const ruleBaseId = linha.product.taxRuleBaseId!.trim();
    const taxRule = await resolveTaxRule(db, tenant.id, {
      originUf: matrizUf,
      destinationUf: destino.uf,
      transactionType: "inbound",
      customerType: "taxpayer",
      ruleBaseId,
    });
    if (!taxRule) {
      throw new BranchTransferError(`Regra fiscal ausente para "${linha.product.sku}".`);
    }

    const cfop = resolveTransferenciaCfop(matrizUf, destino.uf);
    linhasComRegras.push({
      line: {
        ...orderLineFromProduct(linha.product, {
          cfop,
          quantidade: linha.quantidade,
          valorUnitario: unitCusto,
        }),
        numeroItem: index + 1,
      },
      rule: taxRule,
    });
  }

  const nota = calculateInvoiceTaxes(
    linhasComRegras,
    { ufOrigem: matrizUf, ufDestino: destino.uf, customerType: "taxpayer" },
    aliqFallback,
  );

  const valor = nota.totais.vNF;
  const valorIcms = nota.totais.vICMS;
  const quantidadeTotal = linhas.reduce((acc, l) => acc + l.quantidade, 0);
  const primeiro = linhas[0]!.product;
  const cfopHeader = linhasComRegras[0]!.line.cfop;
  const aliqIcms = valor > 0 ? Math.round((valorIcms / valor) * 10000) / 100 : aliqFallback;

  const chaveParams = chaveEmissaoFromOverride(matrizEmitente);
  const serie = chaveParams.serie;
  const numeroInicial = resolveNumeroInicialNfe(emitterSettings, serie, {
    serieRemessa: tenant.serieRemessa,
    serieTransferencia: tenant.serieTransferencia,
  });
  const numero = await proximoNumeroNfe(db, tenant.id, serie, numeroInicial);
  const chave = buildChaveNFe({ uf: chaveParams.uf, cnpj: chaveParams.cnpj, serie, numero });
  const emitidaEm = new Date();
  const logistics = createLogisticsModule();

  const { nfeRow, itemRows } = await runFiscalTransaction(db, tenant.id, async (tx) => {
    const fiscalPayload = enrichFiscalPayloadMlFulfillment(
      enrichFiscalPayloadWithXTexto(
        {
          ...enrichTaxSnapshot(taxSnapshotFromRule(linhasComRegras[0]!.rule, aliqFallback, emitterSettings), {
            settings: emitterSettings,
            tipo: NFeTipo.TRANSFERENCIA_FILIAL,
            valor,
            valorIcms,
            emitUf: matrizUf,
            destUf: destino.uf,
            indFinal: 0,
          }),
          engine: nota,
          destIe: destino.ie,
        } as Record<string, unknown>,
        {
          tipo: NFeTipo.TRANSFERENCIA_FILIAL,
          cfop: cfopHeader,
          natOp: TRANSFERENCIA_FILIAL_NAT_OP,
          pedidoMl,
        },
      ),
      { quantidadeTotal, destIe: destino.ie, withLogistics: false },
    );
    const fiscalPayloadWithEmit = {
      ...fiscalPayload,
      emitSnapshot: matrizEmitente.emitSnapshot,
    };

    const nfeRow = await tx.nFe.create({
      data: {
        tenantId: tenant.id,
        productId: linhas.length === 1 ? primeiro.id : null,
        chave,
        numero,
        serie,
        natOp: TRANSFERENCIA_FILIAL_NAT_OP,
        cfop: cfopHeader,
        ncm: primeiro.ncm,
        ...destData,
        valor,
        valorIcms,
        aliqIcms,
        status: FiscalStatus.AUTORIZADA,
        emitidaEm,
        pedidoMl,
        quantidade: quantidadeTotal,
        tipo: NFeTipo.TRANSFERENCIA_FILIAL,
        saldoDisponivel: null,
        fiscalPayload: fiscalPayloadWithEmit as Prisma.InputJsonValue,
      },
    });

    const itemRows = [];
    for (const [index, linha] of linhas.entries()) {
      const engineItem = nota.itens[index];
      if (!engineItem) {
        throw new BranchTransferError(`Falha ao calcular item ${index + 1} da transferência`);
      }
      const itemRow = await tx.nfeItem.create({
        data: {
          tenantId: tenant.id,
          nfeId: nfeRow.id,
          productId: linha.product.id,
          numeroItem: index + 1,
          quantidade: linha.quantidade,
          valor: engineItem.vProd,
          valorIcms: engineItem.icms.vICMS,
          ncm: linha.product.ncm,
          cfop: linhasComRegras[index]!.line.cfop,
          saldoDisponivel: null,
        },
        include: { product: true },
      });
      itemRows.push(itemRow);

      await logistics.registerProductMovement.execute(
        {
          tenantId: tenant.id,
          productId: linha.product.id,
          tipoOperacao: OperacaoFiscalTipo.TRANSFERENCIA_FILIAL,
          quantidade: linha.quantidade,
          nfeId: nfeRow.id,
          observacao: `Transferência matriz → filial ${filial.cnpj}`,
        },
        tx,
      );
    }

    await persistNfeXmlAutorizado(tx, {
      nfeId: nfeRow.id,
      tenant,
      nfeRow: { ...nfeRow, fiscalPayload: fiscalPayloadWithEmit },
      products: linhas.map((l) => l.product),
      itemRows,
      settings: emitterSettings,
    });

    return { nfeRow, itemRows };
  });

  return { nfe: mapNfe(nfeRow, undefined, itemRows), id: nfeRow.id };
}

/**
 * Build emitter override from branch entity for automatic shipment emission.
 */
export function buildEmitenteOverride(filial: TenantFilial): EmitenteEmissaoOverride {
  const emitSnapshot = mapEmitenteFromFilial(filial);
  return {
    uf: filial.uf.toUpperCase(),
    cnpj: filial.cnpj.replace(/\D/g, ""),
    serie: filial.serieRemessa,
    emitSnapshot,
  };
}
