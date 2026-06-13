/**
 * Cálculo fiscal unificado para NF-e de remessa simbólica (CFOP 5949/6949 conforme UF).
 */
import { NFeTipo } from "../../../../generated/prisma/client.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import { resolveRemessaCfop } from "./helpers/remessa-dest.js";
import { REMESSA_SIMBOLICA_NAT_OP } from "./helpers/remessa-simbolica-dest.js";
import { enrichTaxSnapshot, loadEmitterSettings } from "../../../fiscal-settings/application/services/fiscal-emitter-runtime.js";
import {
  enrichFiscalPayloadMlFulfillment,
  enrichFiscalPayloadWithXTexto,
  productUnitPrice,
} from "@msimulation-xml/fiscal-core";
import { taxSnapshotFromRule } from "../../../tax/domain/services/tax-snapshot.js";
import {
  calcularNotaInbound,
  inferAliqIcmsRemessa,
  linhaPedidoFromProduto,
  type ProdutoLinhaFiscal,
  type ResultadoNotaInbound,
} from "../../../tax/index.js";
import { resolveTaxRule } from "../../../tax/index.js";

type ProductPrices = {
  preco: { toString(): string } | number;
  precoCusto: { toString(): string } | number;
};

export type ProdutoRemessaSimbolica = ProdutoLinhaFiscal &
  ProductPrices & {
    taxRuleBaseId: string | null;
  };

export type RemessaSimbolicaFiscalPreparada = {
  calc: ResultadoNotaInbound;
  cfop: string;
  natOp: string;
  fiscalPayload: Record<string, unknown>;
};

export class RemessaSimbolicaFiscalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RemessaSimbolicaFiscalError";
  }
}

export async function prepararRemessaSimbolicaFiscal(
  prisma: PrismaTx,
  input: {
    tenantId: string;
    emitUf: string;
    destUf: string;
    product: ProdutoRemessaSimbolica;
    quantidade: number;
    pedidoMl: string;
  },
): Promise<RemessaSimbolicaFiscalPreparada> {
  const unitCusto = productUnitPrice(input.product, "REMESSA");
  if (unitCusto <= 0) {
    throw new RemessaSimbolicaFiscalError(
      "Preço de custo não informado ou zero. Informe o custo no cadastro do produto.",
    );
  }

  const ruleBaseId = input.product.taxRuleBaseId?.trim();
  if (!ruleBaseId) {
    throw new RemessaSimbolicaFiscalError(
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
    throw new RemessaSimbolicaFiscalError(
      `Regra "${ruleBaseId}" sem linha inbound (envio de estoque) para ${input.emitUf} → ${input.destUf}. Importe ou revise a planilha.`,
    );
  }

  const emitterSettings = await loadEmitterSettings(prisma, input.tenantId);
  const aliqFallback = inferAliqIcmsRemessa(input.emitUf, input.destUf, emitterSettings);
  const cfop = resolveRemessaCfop(input.emitUf, input.destUf);
  const calc = calcularNotaInbound(
    linhaPedidoFromProduto(input.product, {
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
          tipo: NFeTipo.REMESSA_SIMBOLICA,
          valor: calc.valor,
          valorIcms: calc.valorIcms,
          emitUf: input.emitUf,
          destUf: input.destUf,
          indFinal: 0,
        }),
        engine: calc.nota,
      } as Record<string, unknown>,
      {
        tipo: NFeTipo.REMESSA_SIMBOLICA,
        cfop,
        natOp: REMESSA_SIMBOLICA_NAT_OP,
        pedidoMl: input.pedidoMl,
      },
    ),
    {
      quantidadeTotal: input.quantidade,
      withLogistics: true,
    },
  );

  return {
    calc,
    cfop,
    natOp: REMESSA_SIMBOLICA_NAT_OP,
    fiscalPayload,
  };
}
