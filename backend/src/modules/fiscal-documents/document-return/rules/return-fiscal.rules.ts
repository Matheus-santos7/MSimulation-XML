/** Regras fiscais compartilhadas pela devolução de venda e pelo retorno físico. */
import { normalizeTaxStCode, type MarketplaceCode } from "@msimulation-xml/fiscal-core";
import { Prisma, type Product } from "../../../../generated/prisma/client.js";
import { type PrismaTx } from "../../../../lib/db/prisma-tx.js";
import { type ItemFiscalResult } from "../../../tax/index.js";
import { type CustomerType } from "../../../tax/index.js";
import {
  collectRemessaSaldoProductIds,
  type ReturnFifoReversalLine,
} from "../../../remessas/index.js";
import { destIeRetornoFromRemessa } from "../../../remessas/index.js";
import { DocumentReturnError } from "../../errors/fiscal-documents.errors.js";
import type { RequestedReturnLine, ReturnableLine } from "./devolucao-itens.js";

/** Linha devolvida nesta operação, já validada, com o produto da venda. */
export type ReturnLine = RequestedReturnLine & { product: Product };

export function resolveCustomerType(destIndIeDest: number): CustomerType {
  return destIndIeDest === 9 ? "non_taxpayer" : "taxpayer";
}

/**
 * Persiste as linhas (`nfe_itens`) da devolução / remessa simbólica pós-devolução.
 * `saldoDisponivel` fica nulo: essas notas não alimentam o FIFO de remessas.
 */
export async function createReturnItemRows(
  tx: PrismaTx,
  args: {
    tenantId: string;
    nfeId: string;
    cfop: string;
    lines: ReturnLine[];
    engineItems: ItemFiscalResult[];
  },
) {
  const rows = [];
  for (const [index, line] of args.lines.entries()) {
    const engineItem = args.engineItems[index];
    if (!engineItem) {
      throw new DocumentReturnError(`Falha ao calcular o item ${index + 1} da devolução.`, 422);
    }
    rows.push(
      await tx.nfeItem.create({
        data: {
          tenantId: args.tenantId,
          nfeId: args.nfeId,
          productId: line.product.id,
          numeroItem: index + 1,
          quantidade: line.quantidade,
          valor: engineItem.vProd,
          valorIcms: engineItem.icms.vICMS,
          ncm: line.product.ncm,
          cfop: args.cfop,
          saldoDisponivel: null,
        },
        include: { product: true },
      }),
    );
  }
  return rows;
}

/**
 * Linhas de estorno FIFO por produto: quantidade devolvida agora e quanto do mesmo
 * produto já havia sido devolvido (e estornado) antes. Inclui IDs legados do SKU.
 */
export async function buildFifoReversalLines(
  tx: PrismaTx,
  tenantId: string,
  returnLines: ReturnLine[],
  returnable: ReturnableLine[],
): Promise<ReturnFifoReversalLine[]> {
  const byProduct = new Map<string, { product: Product; quantidade: number }>();
  for (const line of returnLines) {
    const acc = byProduct.get(line.product.id);
    if (acc) acc.quantidade += line.quantidade;
    else byProduct.set(line.product.id, { product: line.product, quantidade: line.quantidade });
  }

  const result: ReturnFifoReversalLine[] = [];
  for (const { product, quantidade } of byProduct.values()) {
    const jaEstornado = returnable
      .filter((line) => line.productId === product.id)
      .reduce((sum, line) => sum + line.quantidadeDevolvida, 0);
    const productIds = await collectRemessaSaldoProductIds(
      tx as unknown as Parameters<typeof collectRemessaSaldoProductIds>[0],
      tenantId,
      product.id,
      product.sku ?? undefined,
    );
    result.push({ productIds, quantidade, jaEstornado });
  }
  return result;
}

/** Return CFOP (inbound): interstate → 2202, intrastate → 1202. */
export function resolveReturnCfop(emitterUf: string, destinationUf: string): string {
  return emitterUf.toUpperCase() !== destinationUf.toUpperCase() ? "2202" : "1202";
}

/** Retorno físico CFOP 1949/2949 (entrada contra o OL). */
export function resolveRetornoFisicoCfop(emitterUf: string, destinationUf: string): string {
  return emitterUf.toUpperCase() === destinationUf.toUpperCase() ? "1949" : "2949";
}

/**
 * IE do Operador Logístico para `<dest><IE>` / `fiscalPayload.destIe`.
 * Ordem: payload da remessa → unidade vinculada → CD do marketplace da remessa pelo CNPJ do dest.
 * Conforme CAT 31 / MOC: com indIEDest=1 a IE do CD é obrigatória.
 */
export async function resolveDestIeForOperadorLogistico(
  tx: PrismaTx,
  remessa: {
    marketplace: MarketplaceCode;
    fiscalPayload: unknown;
    destDoc: string;
    unidadeDestino?: { ie: string | null } | null;
  },
): Promise<string | undefined> {
  const fromChain = destIeRetornoFromRemessa(
    { fiscalPayload: remessa.fiscalPayload as Prisma.JsonValue },
    remessa.unidadeDestino ?? null,
  );
  if (fromChain) return fromChain;

  const cnpj = remessa.destDoc.replace(/\D/g, "");
  if (cnpj.length !== 14) return undefined;

  const unit = await tx.unidadeLogistica.findUnique({
    where: { marketplace_cnpj: { marketplace: remessa.marketplace, cnpj } },
    select: { ie: true },
  });
  const digits = unit?.ie?.replace(/\D/g, "") ?? "";
  return digits || undefined;
}

export function idCadIntTranFromRemessaFiscalPayload(payload: unknown): string | undefined {
  const root = (payload ?? {}) as Record<string, unknown>;
  const intermed = root.infIntermed as Record<string, unknown> | undefined;
  const id = intermed?.idCadIntTran;
  return typeof id === "string" && id.trim() ? id.trim() : undefined;
}

/**
 * `<entrega>` = OL onde a mercadoria retorna fisicamente (dest da remessa/retorno simbólico).
 */
export function entregaFromOperadorLogistico(
  ol:
    | {
        destDoc: string;
        destNome: string;
        destLogradouro: string | null;
        destNumero: string | null;
        destComplemento: string | null;
        destBairro: string | null;
        destCodigoMunicipio: string | null;
        destMunicipio: string | null;
        destUf: string;
        destCep: string | null;
        destCodigoPais: number | null;
        destNomePais: string | null;
        destTelefone: string | null;
      }
    | null
    | undefined,
): Record<string, unknown> | undefined {
  if (!ol) return undefined;
  const cnpj = String(ol.destDoc ?? "").replace(/\D/g, "");
  if (cnpj.length !== 14) return undefined;
  if (!ol.destLogradouro?.trim() || !ol.destCodigoMunicipio?.trim() || !ol.destUf?.trim()) {
    return undefined;
  }
  return {
    CNPJ: cnpj,
    xNome: ol.destNome,
    xLgr: ol.destLogradouro,
    nro: ol.destNumero?.trim() || "S/N",
    ...(ol.destComplemento?.trim() ? { xCpl: ol.destComplemento.trim() } : {}),
    xBairro: ol.destBairro?.trim() || "S/N",
    cMun: ol.destCodigoMunicipio.trim(),
    xMun: ol.destMunicipio?.trim() || ol.destCodigoMunicipio.trim(),
    UF: ol.destUf.trim().toUpperCase(),
    ...(ol.destCep
      ? { CEP: String(ol.destCep).replace(/\D/g, "").padStart(8, "0").slice(0, 8) }
      : {}),
    ...(ol.destCodigoPais != null ? { cPais: String(ol.destCodigoPais) } : {}),
    ...(ol.destNomePais ? { xPais: ol.destNomePais } : {}),
    ...(ol.destTelefone ? { fone: String(ol.destTelefone).replace(/\D/g, "") } : {}),
  };
}

/** Mantém `infIntermed` da venda/remessa (NT 2023.004 / marketplace). */
export function resolveInfIntermedForReturn(
  salePayload: Record<string, unknown> | undefined,
  olNfe: { fiscalPayload: unknown } | null | undefined,
): { CNPJ?: string; idCadIntTran: string } | undefined {
  const fromSale = salePayload?.infIntermed;
  if (fromSale && typeof fromSale === "object" && !Array.isArray(fromSale)) {
    const id = (fromSale as Record<string, unknown>).idCadIntTran;
    if (typeof id === "string" && id.trim()) {
      return fromSale as { CNPJ?: string; idCadIntTran: string };
    }
  }
  const idFromOl = idCadIntTranFromRemessaFiscalPayload(olNfe?.fiscalPayload);
  if (!idFromOl) return undefined;
  const olRoot = (olNfe?.fiscalPayload ?? {}) as Record<string, unknown>;
  const olIntermed = olRoot.infIntermed as Record<string, unknown> | undefined;
  const cnpj =
    typeof olIntermed?.CNPJ === "string" ? olIntermed.CNPJ.replace(/\D/g, "") : undefined;
  return {
    ...(cnpj && cnpj.length === 14 ? { CNPJ: cnpj } : {}),
    idCadIntTran: idFromOl,
  };
}

export function extractCstFromPayload(payload: unknown): {
  icms?: string;
  pis?: string;
  cofins?: string;
} {
  const root = (payload ?? {}) as Record<string, unknown>;
  const icms = (root.icms ?? {}) as Record<string, unknown>;
  const pis = (root.pis ?? {}) as Record<string, unknown>;
  const cofins = (root.cofins ?? {}) as Record<string, unknown>;
  const asCst = (value: unknown): string | undefined => {
    const code = normalizeTaxStCode(value);
    return code || undefined;
  };
  return {
    icms: asCst(icms.cst),
    pis: asCst(pis.st),
    cofins: asCst(cofins.st),
  };
}
