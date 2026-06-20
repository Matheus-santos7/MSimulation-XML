/**
 * Cálculo fiscal unificado para NF-e de remessa simbólica (CFOP 5949/6949 conforme UF).
 */
import { NFeTipo } from "../../../../../generated/prisma/client.js";
import type { PrismaTx } from "../../../../../lib/db/prisma-tx.js";
import { resolveRemessaCfop } from "../helpers/remessa-dest.js";
import { REMESSA_SIMBOLICA_NAT_OP } from "../helpers/remessa-simbolica-dest.js";
import { enrichTaxSnapshot, loadEmitterSettings } from "../../../../fiscal-settings/application/services/fiscal-emitter-runtime.js";
import {
  enrichFiscalPayloadMlFulfillment,
  enrichFiscalPayloadWithXTexto,
  productUnitPrice,
} from "@msimulation-xml/fiscal-core";
import { taxSnapshotFromRule } from "../../../../tax/domain/services/tax-snapshot.js";
import {
  calculateInboundInvoice,
  inferIcmsRateForShipment,
  orderLineFromProduct,
} from "../../../../tax/index.js";
import { resolveTaxRule } from "../../../../tax/index.js";
import type {
  SymbolicShipmentProduct,
  SymbolicShipmentFiscalPrepared,
  SymbolicShipmentAfterReturnInput,
} from "./symbolic-shipment.types.js";
import { SymbolicShipmentFiscalError } from "./symbolic-shipment.errors.js";

/**
 * Prepara os dados fiscais para emissão de uma NF-e de remessa simbólica.
 * 
 * @param prisma - Transaction context
 * @param input - Symbolic shipment input parameters
 * @returns Prepared fiscal data including tax calculation and fiscal payload
 * @throws {SymbolicShipmentFiscalError} When product cost is invalid or tax rule is missing
 */
export async function prepareSymbolicShipmentFiscal(
  prisma: PrismaTx,
  input: {
    tenantId: string;
    emitUf: string;
    destUf: string;
    product: SymbolicShipmentProduct;
    quantidade: number;
    pedidoMl: string;
    /** Reposição no CD após devolução de venda — ajusta infCpl e xTexto. */
    posDevolucao?: SymbolicShipmentAfterReturnInput;
    /** Tipo persistido na NF-e; avanço entre CDs usa `REMESSA_AVANCO`. */
    nfeTipo?: typeof NFeTipo.REMESSA_SIMBOLICA | typeof NFeTipo.REMESSA_AVANCO;
    destIe?: string | null;
    remessaSerie?: number;
    idCadIntTran?: string | null;
  },
): Promise<SymbolicShipmentFiscalPrepared> {
  const nfeTipo = input.nfeTipo ?? NFeTipo.REMESSA_SIMBOLICA;
  const unitCusto = productUnitPrice(input.product, nfeTipo);
  if (unitCusto <= 0) {
    throw new SymbolicShipmentFiscalError(
      "Preço de custo não informado ou zero. Informe o custo no cadastro do produto.",
    );
  }

  const ruleBaseId = input.product.taxRuleBaseId?.trim();
  if (!ruleBaseId) {
    throw new SymbolicShipmentFiscalError(
      "Produto sem regra fiscal associada. Edite o cadastro e selecione a regra da planilha.",
    );
  }

  const taxRule = await resolveTaxRule(prisma, input.tenantId, {
    originUf: input.emitUf,
    destinationUf: input.destUf,
    transactionType: "inbound",
    customerType: "taxpayer",
    ruleBaseId,
  });
  if (!taxRule) {
    throw new SymbolicShipmentFiscalError(
      `Regra "${ruleBaseId}" sem linha inbound (envio de estoque) para ${input.emitUf} → ${input.destUf}. Importe ou revise a planilha.`,
    );
  }

  const emitterSettings = await loadEmitterSettings(prisma, input.tenantId);
  const aliqFallback = inferIcmsRateForShipment(input.emitUf, input.destUf, emitterSettings);
  const cfop = resolveRemessaCfop(input.emitUf, input.destUf);
  const calc = calculateInboundInvoice(
    orderLineFromProduct(input.product, {
      cfop,
      quantidade: input.quantidade,
      valorUnitario: unitCusto,
    }),
    taxRule,
    input.emitUf,
    input.destUf,
    aliqFallback,
  );

  const fiscalPayload = enrichFiscalPayloadMlFulfillment(
    enrichFiscalPayloadWithXTexto(
      {
        ...enrichTaxSnapshot(taxSnapshotFromRule(taxRule, aliqFallback, emitterSettings), {
          settings: emitterSettings,
          tipo: nfeTipo,
          valor: calc.valor,
          valorIcms: calc.valorIcms,
          emitUf: input.emitUf,
          destUf: input.destUf,
          indFinal: 0,
        }),
        engine: calc.nota,
        ...(input.posDevolucao
          ? {
              remessaSimbolicaPosDevolucao: {
                numero: input.posDevolucao.numero,
                serie: input.posDevolucao.serie,
                emitidaEm:
                  input.posDevolucao.emitidaEm instanceof Date
                    ? input.posDevolucao.emitidaEm.toISOString()
                    : input.posDevolucao.emitidaEm,
              },
            }
          : {}),
        ...(input.destIe?.trim() ? { destIe: input.destIe.replace(/\D/g, "") } : {}),
      } as Record<string, unknown>,
      {
        tipo: nfeTipo,
        cfop,
        natOp: REMESSA_SIMBOLICA_NAT_OP,
        pedidoMl: input.pedidoMl,
        ...(input.posDevolucao
          ? {
              posDevolucao: true,
              serie: input.remessaSerie ?? input.posDevolucao.serie,
            }
          : {}),
        ...(input.idCadIntTran?.trim() ? { warehouseId: input.idCadIntTran.trim() } : {}),
      },
    ),
    {
      quantidadeTotal: input.quantidade,
      withLogistics: true,
      destIe: input.destIe,
      idCadIntTran: input.idCadIntTran,
    },
  );

  return {
    calc,
    cfop,
    natOp: REMESSA_SIMBOLICA_NAT_OP,
    fiscalPayload,
  };
}
