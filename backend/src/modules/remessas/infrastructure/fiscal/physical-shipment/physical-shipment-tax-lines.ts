import { productUnitPrice } from "@msimulation-xml/fiscal-core";
import { orderLineFromProduct, resolveTaxRule } from "../../../../tax/index.js";
import { resolveRemessaCfop } from "../helpers/remessa-dest.js";
import { ShipmentError } from "./physical-shipment.errors.js";
import type { PhysicalShipmentLineInput } from "./physical-shipment.types.js";
import type { DbClient } from "../../../../../lib/db/prisma-tx.js";

/**
 * Builds physical shipment tax lines by resolving tax rules and CFOPs for each item.
 *
 * Phase 3 of the shipment flow: per-item inbound tax rule + fiscal line.
 *
 * @returns Array of lines with product data, quantities, and resolved tax rules
 */
export async function buildPhysicalShipmentTaxLines(
  db: DbClient,
  tenantId: string,
  linhas: PhysicalShipmentLineInput[],
  emitUf: string,
  destinoUf: string,
) {
  const linhasComRegras: {
    line: ReturnType<typeof orderLineFromProduct>;
    rule: NonNullable<Awaited<ReturnType<typeof resolveTaxRule>>>;
  }[] = [];

  for (const [index, linha] of linhas.entries()) {
    // Shipments use cost price (not sale price).
    const unitCusto = productUnitPrice(linha.product, "REMESSA");
    if (unitCusto <= 0) {
      throw new ShipmentError(
        `Preço de custo não informado ou zero para "${linha.product.sku}". Informe o custo no cadastro do produto.`,
      );
    }

    const ruleBaseId = linha.product.taxRuleBaseId?.trim();
    if (!ruleBaseId) {
      throw new ShipmentError(
        `Produto "${linha.product.sku}" sem regra fiscal. Edite o cadastro e selecione a regra da planilha.`,
      );
    }

    // Tax rule: {ruleBaseId}-taxpayer-inbound, columns ICMS_{UF_DESTINO}_*.
    const remessaTaxRule = await resolveTaxRule(db, tenantId, {
      originUf: emitUf,
      destinationUf: destinoUf,
      transactionType: "inbound",
      customerType: "taxpayer",
      ruleBaseId,
    });
    if (!remessaTaxRule) {
      throw new ShipmentError(
        `Regra "${ruleBaseId}" sem linha de remessa (origem ${emitUf} → ${destinoUf}) para "${linha.product.sku}".`,
      );
    }

    // CFOP 5949 (same state) or 6949 (interstate) — aligned to idDest in XML.
    const cfopRemessa = resolveRemessaCfop(emitUf, destinoUf);
    linhasComRegras.push({
      line: {
        ...orderLineFromProduct(linha.product, {
          cfop: cfopRemessa,
          quantidade: linha.quantidade,
          valorUnitario: unitCusto,
        }),
        numeroItem: index + 1,
      },
      rule: remessaTaxRule,
    });
  }

  return linhasComRegras;
}
