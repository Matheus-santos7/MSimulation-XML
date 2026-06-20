/**
 * Core physical shipment NF-e emission orchestrator (temporary deposit / Full ML).
 *
 * Flow documentation: docs/remessa-fisica.md | Module: modules/remessas/README.md
 *
 * Entry points:
 *  - `emitManualShipment` — dedicated module (POST /movimentacoes/remessa)
 *  - `emitShipmentNfe` — single-item shortcut (e.g., avanco-cd-service)
 *
 * Core: `emitShipmentNfeWithItems` executes phases 2–9 of the document.
 */
import {
  FiscalStatus,
  NFeTipo,
  OperacaoFiscalTipo,
  Prisma,
  type Tenant,
} from "../../../../../generated/prisma/client.js";
import type { DbClient, PrismaTx } from "../../../../../lib/db/prisma-tx.js";
import { runFiscalTransaction } from "../../../../../lib/db/prisma-tx.js";
import { mapNfe } from "../../../../fiscal-documents/presentation/mappers/fiscal-mappers.js";
import {
  buildChaveNFe,
  gerarPedidoMl,
} from "../../../../fiscal-documents/domain/services/nfe-chave.js";
import { proximoNumeroNfe } from "../../../../fiscal-documents/domain/services/nfe-sequencia.js";
import { REMESSA_NAT_OP } from "../helpers/remessa-dest.js";
import {
  enrichTaxSnapshot,
  loadEmitterSettings,
} from "../../../../fiscal-settings/application/services/fiscal-emitter-runtime.js";
import { taxSnapshotFromRule } from "../../../../tax/domain/services/tax-snapshot.js";
import {
  enrichFiscalPayloadMlFulfillment,
  enrichFiscalPayloadWithXTexto,
  resolveNumeroInicialNfe,
} from "@msimulation-xml/fiscal-core";
import { emitShipmentCte } from "../shipment-cte.service.js";
import { calculateInvoiceTaxes, inferIcmsRateForShipment } from "../../../../tax/index.js";
import { createLogisticsModule } from "../../../../logistics/index.js";
import { persistNfeXmlAutorizado } from "../../../../fiscal-documents/infrastructure/xml/nfe-xml-service.js";
import {
  resolveEmitenteFiscal,
  chaveEmissaoFromOverride,
} from "../../../../org/index.js";
import { ShipmentError } from "./physical-shipment.errors.js";
import type {
  EmitShipmentOptions,
  PhysicalShipmentLineInput,
} from "./physical-shipment.types.js";
import { mapShipmentDestinationToNfeFields } from "./physical-shipment-destination.mapper.js";
import { buildPhysicalShipmentTaxLines } from "./physical-shipment-tax-lines.js";
import type { Product } from "../../../../../generated/prisma/client.js";

/**
 * Single-item shortcut for shipment; delegates to `emitShipmentNfeWithItems`.
 */
export async function emitShipmentNfe(
  db: DbClient,
  tenant: Tenant,
  product: Product,
  quantidade: number,
  options?: EmitShipmentOptions,
) {
  if (quantidade < 1) {
    throw new ShipmentError("Quantidade para remessa deve ser pelo menos 1");
  }
  return emitShipmentNfeWithItems(db, tenant, [{ product, quantidade }], options);
}

/**
 * Multi-item emission with advanced options (e.g., branch emitter).
 */
export async function emitShipmentWithItems(
  db: DbClient,
  tenant: Tenant,
  linhas: PhysicalShipmentLineInput[],
  options?: EmitShipmentOptions,
) {
  if (linhas.length === 0) {
    throw new ShipmentError("Informe ao menos um produto na remessa");
  }
  return emitShipmentNfeWithItems(db, tenant, linhas, options);
}

/**
 * Core emission: resolves destination, taxes, persists NF-e + items + XML + CT-e.
 * See docs/remessa-fisica.md for function-by-function mapping.
 */
export async function emitShipmentNfeWithItems(
  db: DbClient,
  tenant: Tenant,
  linhas: PhysicalShipmentLineInput[],
  options?: EmitShipmentOptions,
) {
  if (linhas.length === 0) {
    throw new ShipmentError("Informe ao menos um produto na remessa");
  }

  const emitenteOverride =
    options?.emitenteOverride ?? (await resolveEmitenteFiscal(db, tenant, "principal"));

  // --- Phase 2: recipient (CD ML) — defines destination UF for rule and CFOP ---
  const logistics = createLogisticsModule();
  const destination = await logistics.resolveShipmentDestination.execute(
    tenant.id,
    options?.unidadeDestinoId,
  );
  const destino = destination.destinatarioFiscal;
  const unidade = {
    id: destination.unitId,
    codigo: destination.codigo,
    idCadIntTran: destination.idCadIntTran ?? null,
  };

  const emitterSettings = await loadEmitterSettings(db, tenant.id);
  const emitUf = emitenteOverride.uf;
  const aliqFallback = inferIcmsRateForShipment(emitUf, destino.uf, emitterSettings);
  const pedidoMl = options?.pedidoMl ?? gerarPedidoMl();

  // --- Phase 3: per-item — inbound tax rule + fiscal line ---
  const linhasComRegras = await buildPhysicalShipmentTaxLines(
    db,
    tenant.id,
    linhas,
    emitUf,
    destino.uf,
  );

  // --- Phase 4: tax engine (ICMS, PIS, COFINS, totals) ---
  const nota = calculateInvoiceTaxes(
    linhasComRegras,
    {
      ufOrigem: emitUf,
      ufDestino: destino.uf,
      customerType: "taxpayer",
      operationTipo: "REMESSA",
    },
    aliqFallback,
  );

  const valor = nota.totais.vNF;
  const valorIcms = nota.totais.vICMS;
  const quantidadeTotal = linhas.reduce((acc, l) => acc + l.quantidade, 0);
  const primeiro = linhas[0]!.product;
  const cfopHeader = linhasComRegras[0]!.line.cfop;
  const aliqIcms = valor > 0 ? Math.round((valorIcms / valor) * 10000) / 100 : aliqFallback;

  // --- Phase 5: key and NF-e numbering (tenant shipment series) ---
  const chaveParams = chaveEmissaoFromOverride(emitenteOverride);
  const serie = chaveParams.serie;
  const numeroInicial = resolveNumeroInicialNfe(emitterSettings, serie, {
    serieRemessa: tenant.serieRemessa,
    serieTransferencia: tenant.serieTransferencia,
  });
  const numero = await proximoNumeroNfe(db, tenant.id, serie, numeroInicial);
  const chave = buildChaveNFe({ uf: chaveParams.uf, cnpj: chaveParams.cnpj, serie, numero });
  const emitidaEm = new Date();
  const destData = mapShipmentDestinationToNfeFields(destino);

  // --- Phases 6–9: atomic transaction (payload, NF-e, XML, CT-e) ---
  const { nfeRow, cteRow, itemRows } = await runFiscalTransaction(db, tenant.id, async (tx) => {
    // Phase 6: emitter settings + snapshot for XML/payload.
    const fiscalPayloadBase = enrichFiscalPayloadMlFulfillment(
      enrichFiscalPayloadWithXTexto(
        {
          ...enrichTaxSnapshot(
            taxSnapshotFromRule(linhasComRegras[0]!.rule, aliqFallback, emitterSettings),
            {
              settings: emitterSettings,
              tipo: NFeTipo.REMESSA,
              valor,
              valorIcms,
              emitUf,
              destUf: destino.uf,
              indFinal: 0,
            },
          ),
          engine: nota,
          ...(destino.indIeDest === 1 && destino.ie
            ? { destIe: destino.ie.replace(/\D/g, "") }
            : {}),
        } as Record<string, unknown>,
        {
          tipo: NFeTipo.REMESSA,
          cfop: cfopHeader,
          natOp: REMESSA_NAT_OP,
          pedidoMl,
        },
      ),
      {
        quantidadeTotal,
        destIe: destino.ie,
        idCadIntTran: unidade?.idCadIntTran ?? null,
        withLogistics: true,
      },
    );
    const fiscalPayload = {
      ...fiscalPayloadBase,
      emitSnapshot: emitenteOverride.emitSnapshot,
    };

    // Phase 7: NF-e header.
    const nfeRow = await tx.nFe.create({
      data: {
        tenantId: tenant.id,
        productId: linhas.length === 1 ? primeiro.id : null,
        chave,
        numero,
        serie,
        natOp: REMESSA_NAT_OP,
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
        tipo: NFeTipo.REMESSA,
        saldoDisponivel: null,
        unidadeDestinoId: unidade?.id ?? undefined,
        nfeReferenciaId: options?.nfeReferenciaId ?? undefined,
        fiscalPayload: fiscalPayload as Prisma.InputJsonValue,
      },
    });

    const itemRows = [];
    for (const [index, linha] of linhas.entries()) {
      const engineItem = nota.itens[index];
      if (!engineItem) {
        throw new ShipmentError(`Falha ao calcular item ${index + 1} da remessa`);
      }
      // saldoDisponivel feeds FIFO for future sales (remessa-fifo.ts).
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
          saldoDisponivel: linha.quantidade,
        },
        include: { product: true },
      });
      itemRows.push(itemRow);

      await logistics.registerProductMovement.execute(
        {
          tenantId: tenant.id,
          productId: linha.product.id,
          tipoOperacao: OperacaoFiscalTipo.REMESSA,
          quantidade: linha.quantidade,
          unidadeDestinoId: unidade?.id ?? undefined,
          nfeId: nfeRow.id,
          observacao:
            options?.observacaoAvanco ??
            (unidade ? `Remessa item ${index + 1} para ${unidade.codigo}` : undefined),
        },
        tx,
      );
    }

    // Phase 8: authorized XML via Factory Strategy + XmlSerializer (@msimulation-xml/nfe-xml).
    await persistNfeXmlAutorizado(tx, {
      nfeId: nfeRow.id,
      tenant,
      nfeRow: { ...nfeRow, fiscalPayload },
      products: linhas.map((l) => l.product),
      itemRows,
      settings: emitterSettings,
    });

    // Phase 9: 1:1 linked transport CT-e.
    const cteRow = await emitShipmentCte(tx, tenant, nfeRow);
    return { nfeRow, cteRow, itemRows };
  });

  // Phase 10: response DTO.
  return {
    nfe: mapNfe(nfeRow, undefined, itemRows),
    cte: cteRow,
  };
}
