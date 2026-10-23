/**
 * Emissão da NF-e de remessa física (depósito temporário no CD do marketplace).
 *
 * Fluxo: docs/remessa-fisica.md. O CD de destino define o marketplace: dele saem o perfil
 * fiscal (intermediador, autXML, transporte) e a configuração efetiva do faturador.
 */
import { Inject, Injectable } from "@nestjs/common";
import {
  enrichFiscalPayloadWithXTexto,
  getBillableMarketplaceProfile,
  resolveNumeroInicialNfe,
} from "@msimulation-xml/fiscal-core";
import {
  FiscalStatus,
  NFeTipo,
  OperacaoFiscalTipo,
  Prisma,
  type Tenant,
} from "../../../generated/prisma/client.js";
import type { DbClient } from "../../../lib/db/prisma-tx.js";
import { runFiscalTransaction } from "../../../lib/db/prisma-tx.js";
import { buildChaveNFe, gerarPedidoMl } from "../../fiscal-documents/index.js";
import { proximoNumeroNfe } from "../../fiscal-documents/index.js";
import { persistNfeXmlAutorizado } from "../../fiscal-documents/index.js";
import { mapNfe } from "../../fiscal-documents/index.js";
import { enrichTaxSnapshot, loadEmitterSettings } from "../../fiscal-settings/index.js";
import { LogisticsUnitService, ProductMovementService } from "../../logistics/index.js";
import { chaveEmissaoFromOverride, resolveEmitenteFiscal } from "../../org/index.js";
import {
  calculateInvoiceTaxes,
  inferIcmsRateForShipment,
  taxSnapshotFromRule,
} from "../../tax/index.js";
import { emitShipmentCte } from "../fiscal-chain/shipment-cte.js";
import { REMESSA_NAT_OP } from "./rules/remessa-dest.js";
import { mapShipmentDestinationToNfeFields } from "./shipment-destination.mapper.js";
import { ShipmentError } from "./shipment.errors.js";
import { buildPhysicalShipmentTaxLines } from "./shipment-tax-lines.js";
import type {
  EmitShipmentOptions,
  PhysicalShipmentLineInput,
} from "./types/shipment-emission.types.js";

@Injectable()
export class ShipmentEmitter {
  constructor(
    @Inject(LogisticsUnitService) private readonly units: LogisticsUnitService,
    @Inject(ProductMovementService) private readonly movements: ProductMovementService,
  ) {}

  /**
   * Resolve destino, tributos e numeração; grava NF-e, itens, XML e CT-e numa transação.
   * @throws {MarketplaceNotConfiguredError} CD de um marketplace ainda sem perfil fiscal
   */
  async emit(
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

    // --- Fase 2: destinatário (CD) — UF de destino para regra e CFOP, marketplace do perfil ---
    const destination = await this.units.resolveShipmentDestination(
      tenant.id,
      options?.unidadeDestinoId,
    );
    const marketplace = destination.marketplace;
    const profile = getBillableMarketplaceProfile(marketplace);
    const destino = destination.destinatarioFiscal;
    const unidade = {
      id: destination.unitId,
      codigo: destination.codigo,
      idCadIntTran: destination.idCadIntTran ?? null,
    };

    const emitterSettings = await loadEmitterSettings(db, tenant.id, marketplace);
    const emitUf = emitenteOverride.uf;
    const aliqFallback = inferIcmsRateForShipment(emitUf, destino.uf, emitterSettings);
    const pedidoMl = options?.pedidoMl ?? gerarPedidoMl();

    // --- Fase 3: por item — regra de entrada + linha fiscal ---
    const linhasComRegras = await buildPhysicalShipmentTaxLines(
      db,
      tenant.id,
      linhas,
      emitUf,
      destino.uf,
    );

    // --- Fase 4: motor tributário (ICMS, PIS, COFINS, totais) ---
    // `emitterSettings` projeta `composicaoBaseCalculo.pisCofins` (canal remessa).
    const nota = calculateInvoiceTaxes(
      linhasComRegras,
      {
        ufOrigem: emitUf,
        ufDestino: destino.uf,
        customerType: "taxpayer",
        operationTipo: "REMESSA",
        emitterSettings,
      },
      aliqFallback,
    );

    const valor = nota.totais.vNF;
    const valorIcms = nota.totais.vICMS;
    const quantidadeTotal = linhas.reduce((acc, l) => acc + l.quantidade, 0);
    const primeiro = linhas[0]!.product;
    const cfopHeader = linhasComRegras[0]!.line.cfop;
    const aliqIcms = valor > 0 ? Math.round((valorIcms / valor) * 10000) / 100 : aliqFallback;

    // --- Fase 5: chave e numeração (série de remessa do emitente) ---
    const chaveParams = chaveEmissaoFromOverride(emitenteOverride);
    const serie = chaveParams.serie;
    const numeroInicial = resolveNumeroInicialNfe(emitterSettings, serie, {
      serieRemessa: tenant.serieRemessa,
      serieTransferencia: tenant.serieTransferencia,
    });
    const emitidaEm = new Date();
    const destData = mapShipmentDestinationToNfeFields(destino);

    // --- Fases 6–9: transação atômica (payload, NF-e, XML, CT-e) ---
    const { nfeRow, cteRow, itemRows } = await runFiscalTransaction(db, tenant.id, async (tx) => {
      // Numeração dentro da mesma transação que insere a NF-e: o advisory lock
      // de `proximoNumeroNfe` só fecha a condição de corrida se o número for
      // lido e gravado na mesma transação (ver nfe-sequencia.ts).
      const numero = await proximoNumeroNfe(tx, tenant.id, serie, numeroInicial);
      const chave = buildChaveNFe({ uf: chaveParams.uf, cnpj: chaveParams.cnpj, serie, numero });

      // Fase 6: snapshot tributário + blocos do marketplace no payload.
      const fiscalPayloadBase = profile.enrichFulfillmentPayload(
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
          idCadIntTran: unidade.idCadIntTran,
          withLogistics: true,
        },
      );
      const fiscalPayload = {
        ...fiscalPayloadBase,
        emitSnapshot: emitenteOverride.emitSnapshot,
      };

      // Fase 7: cabeçalho da NF-e.
      const nfeRow = await tx.nFe.create({
        data: {
          tenantId: tenant.id,
          marketplace,
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
          unidadeDestinoId: unidade.id,
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
        // saldoDisponivel alimenta o FIFO das vendas (remessa-fifo.ts).
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

        await this.movements.register(
          {
            tenantId: tenant.id,
            productId: linha.product.id,
            tipoOperacao: OperacaoFiscalTipo.REMESSA,
            quantidade: linha.quantidade,
            unidadeDestinoId: unidade.id,
            nfeId: nfeRow.id,
            observacao:
              options?.observacaoAvanco ?? `Remessa item ${index + 1} para ${unidade.codigo}`,
          },
          tx,
        );
      }

      // Fase 8: XML autorizado (@msimulation-xml/nfe-xml).
      await persistNfeXmlAutorizado(tx, {
        nfeId: nfeRow.id,
        tenant,
        nfeRow: { ...nfeRow, fiscalPayload },
        products: linhas.map((l) => l.product),
        itemRows,
        settings: emitterSettings,
      });

      // Fase 9: CT-e de transporte vinculado 1:1.
      const cteRow = await emitShipmentCte(tx, tenant, nfeRow);

      return { nfeRow, cteRow, itemRows };
    });

    return {
      nfe: mapNfe(nfeRow, undefined, itemRows),
      cte: cteRow,
    };
  }
}
