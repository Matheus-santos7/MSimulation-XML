import { NFeTipo, type NFeTipoValue } from "./nfe-tipo.js";

/** Sufixo fixo do depósito ML nos XMLs de referência (OLSS). */
export const ML_OLSS_WAREHOUSE_SUFFIX = "279642028";

export type XTextoInput = {
  tipo: NFeTipoValue | string;
  cfop: string;
  natOp: string;
  pedidoMl: string;
  indFinal?: number;
  /** Série da NF-e emitida (segmento antes de OLSS no padrão ML). */
  serie?: number;
  /** idCadIntTran do CD — sufixo OLSS no external_id. */
  warehouseId?: string;
  /** Remessa simbólica de reposição após devolução de venda. */
  posDevolucao?: boolean;
};

/**
 * Gera o conteúdo de `<obsCont><xTexto>` cruzando CFOP × natOp × tipo,
 * padrão extraído dos XMLs reais em XMLs/ (campo xCampo="external_id").
 */
export function buildNfeObsContXTexto(input: XTextoInput): string | null {
  const pedido = input.pedidoMl.trim();
  if (!pedido) return null;

  const nat = input.natOp;
  const cfop = input.cfop.trim();
  const tipo = String(input.tipo);
  const warehouseId = input.warehouseId?.trim() || ML_OLSS_WAREHOUSE_SUFFIX;
  const serieSeg = input.serie ?? 1;

  if (
    tipo === NFeTipo.REMESSA_SIMBOLICA ||
    tipo === NFeTipo.REMESSA_AVANCO ||
    (nat.includes("Remessa Simbolica") && nat.includes("Saidas"))
  ) {
    if (tipo === NFeTipo.REMESSA_SIMBOLICA && (input.posDevolucao || cfop === "6949" || nat.includes("SALE_RETURN"))) {
      return `SALE_RETURN-symbolic_inbound-${pedido}-${serieSeg}-OLSS-${warehouseId}`;
    }
    return `DEVOLUTION-symbolic_inbound-${pedido}-${serieSeg}-OLSS-${warehouseId}`;
  }

  if (tipo === NFeTipo.REMESSA || (nat.includes("Remessa para Deposito") && !nat.includes("Simbolica"))) {
    return `INBOUND-inbound-${pedido}-1-1-OLSS-${warehouseId}`;
  }

  if (
    tipo === NFeTipo.RETORNO_SIMBOLICO ||
    nat.includes("Retorno Simbolico") ||
    (nat.includes("Retorno") && cfop.startsWith("1") && cfop !== "1201")
  ) {
    return `SALE-symbolic_inbound_return-${pedido}-${serieSeg}-OLSS-${warehouseId}`;
  }

  if (tipo === NFeTipo.DEVOLUCAO || nat.includes("Devolucao")) {
    return `DEVOLUTION-devolution-${pedido}-${serieSeg}-OLSS-${warehouseId}`;
  }

  if (tipo === NFeTipo.VENDA || nat.toLowerCase().includes("venda")) {
    const consumidorFinal =
      input.indFinal === 1 ||
      nat.includes("consumidor final") ||
      cfop === "5101" ||
      cfop === "6107";
    if (consumidorFinal) {
      return pedido;
    }
    return `SALE-sale-${pedido}-${serieSeg}-OLSS-${warehouseId}`;
  }

  if (nat.includes("Retorno de mercadoria nao entregue")) {
    return `SALE_RETURN-sale_return-${pedido}-${serieSeg}-OLSS-${warehouseId}`;
  }

  return null;
}

export function enrichFiscalPayloadWithXTexto(
  payload: Record<string, unknown>,
  input: XTextoInput,
): Record<string, unknown> {
  const xTexto = buildNfeObsContXTexto(input);
  if (!xTexto) return payload;
  return { ...payload, obsContXTexto: xTexto };
}

/** Aceita `pedidoMl` (API/backend) ou `pedidoML` (DTO legado do frontend). */
export function resolvePedidoMl(fields: { pedidoMl?: string; pedidoML?: string }): string {
  return (fields.pedidoMl ?? fields.pedidoML ?? "").trim();
}

export function xTextoFromNfe(nfe: {
  tipo: string;
  cfop: string;
  natOp: string;
  serie?: number;
  pedidoMl?: string;
  pedidoML?: string;
  fiscalPayload?: Record<string, unknown>;
  destinatario?: { indIEDest?: number };
}): string | null {
  const fromPayload = nfe.fiscalPayload?.obsContXTexto;
  if (typeof fromPayload === "string" && fromPayload.trim()) return fromPayload.trim();

  const pedidoMl = resolvePedidoMl(nfe);
  const fiscal = nfe.fiscalPayload ?? {};
  const intermed = fiscal.infIntermed as Record<string, unknown> | undefined;
  const warehouseId =
    typeof intermed?.idCadIntTran === "string" && intermed.idCadIntTran.trim()
      ? intermed.idCadIntTran.trim()
      : undefined;

  return buildNfeObsContXTexto({
    tipo: nfe.tipo,
    cfop: nfe.cfop,
    natOp: nfe.natOp,
    pedidoMl,
    serie: nfe.serie,
    warehouseId,
    posDevolucao: !!fiscal.remessaSimbolicaPosDevolucao,
    indFinal:
      nfe.natOp.includes("consumidor final") || nfe.destinatario?.indIEDest === 9 ? 1 : 0,
  });
}
