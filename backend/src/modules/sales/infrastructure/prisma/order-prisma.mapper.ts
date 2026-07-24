import type { PedidoStatus, Product } from "../../../../generated/prisma/client.js";
import type { Buyer } from "../../domain/entities/buyer.entity.js";
import type { Order, OrderItemSummary } from "../../domain/entities/order.entity.js";
import type { OrderForEmit } from "../../domain/entities/order-for-emit.entity.js";
import { mapOrderItemFromRow } from "./order-item-prisma.mapper.js";
import { normalizeOrderFreight } from "../../domain/services/order-freight.validation.js";
import { num } from "../../../fiscal-documents/presentation/mappers/fiscal-mappers.js";

export type PedidoItemRow = {
  id: string;
  productId: string;
  numeroItem: number;
  quantidade: number;
  desconto: { toString(): string };
  xPed: string | null;
  product: Product;
};

type OrderRow = {
  id: string;
  tenantId: string;
  status: PedidoStatus;
  pedidoMl: string | null;
  nfeId: string | null;
  destCpf: string;
  destNome: string;
  destLogradouro: string;
  destNumero: string;
  destComplemento: string | null;
  destBairro: string;
  destCodigoMunicipio: string;
  destMunicipio: string;
  destUf: string;
  destCep: string;
  destCodigoPais: number;
  destNomePais: string;
  destTelefone: string | null;
  destIndIeDest: number;
  destIe: string | null;
  freteConsumidor: { toString(): string };
  freteSeller: { toString(): string };
  createdAt: Date;
  updatedAt: Date;
  itens: PedidoItemRow[];
  nfe?: {
    chave: string;
    numero: number;
    serie: number;
    status: string;
  } | null;
};

export function mapOrderFromPrisma(row: OrderRow): Order {
  const items = row.itens
    .slice()
    .sort((a, b) => a.numeroItem - b.numeroItem)
    .map(mapOrderItemFromRow);
  const { freteConsumidor, freteSeller } = normalizeOrderFreight({
    freteConsumidor: num(row.freteConsumidor),
    freteSeller: num(row.freteSeller),
  });
  const itemsSubtotal = Math.round(items.reduce((acc, item) => acc + item.valorTotalLinha, 0) * 100) / 100;
  const valorTotal = Math.round((itemsSubtotal + freteConsumidor) * 100) / 100;

  return {
    id: row.id,
    tenantId: row.tenantId,
    status: row.status,
    pedidoMl: row.pedidoMl ?? undefined,
    items,
    freteConsumidor,
    freteSeller,
    comprador: {
      cpf: row.destCpf,
      nome: row.destNome,
      logradouro: row.destLogradouro,
      numero: row.destNumero,
      complemento: row.destComplemento ?? undefined,
      bairro: row.destBairro,
      codigoMunicipio: row.destCodigoMunicipio,
      municipio: row.destMunicipio,
      uf: row.destUf,
      cep: row.destCep,
      telefone: row.destTelefone ?? undefined,
      codigoPais: row.destCodigoPais,
      nomePais: row.destNomePais,
      indIEDest: row.destIndIeDest,
      ie: row.destIe ?? undefined,
    },
    valorTotal,
    nfe: row.nfe
      ? {
          chave: row.nfe.chave,
          numero: row.nfe.numero,
          serie: row.nfe.serie,
          status: row.nfe.status,
        }
      : undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    editavel: row.status === "RASCUNHO",
    excluivel: true,
  };
}

export function mapOrderForEmitFromPrisma(
  pedido: OrderRow & {
    tenant: OrderForEmit["tenant"];
  },
): OrderForEmit {
  const { freteConsumidor, freteSeller } = normalizeOrderFreight({
    freteConsumidor: num(pedido.freteConsumidor),
    freteSeller: num(pedido.freteSeller),
  });
  const items = pedido.itens
    .slice()
    .sort((a, b) => a.numeroItem - b.numeroItem)
    .map((item) => {
      const desconto = num(item.desconto);
      return {
        productId: item.productId,
        quantidade: item.quantidade,
        product: item.product,
        ...(desconto > 0 ? { valorDesconto: desconto } : {}),
        ...(item.xPed?.trim() ? { xPed: item.xPed.trim() } : {}),
      };
    });

  return {
    tenantId: pedido.tenantId,
    items,
    ...(freteConsumidor > 0 ? { valorFreteConsumidor: freteConsumidor } : {}),
    ...(freteSeller > 0 ? { valorFreteSeller: freteSeller } : {}),
    destCpf: pedido.destCpf,
    destNome: pedido.destNome,
    destLogradouro: pedido.destLogradouro,
    destNumero: pedido.destNumero,
    destComplemento: pedido.destComplemento,
    destBairro: pedido.destBairro,
    destCodigoMunicipio: pedido.destCodigoMunicipio,
    destMunicipio: pedido.destMunicipio,
    destUf: pedido.destUf,
    destCep: pedido.destCep,
    destCodigoPais: pedido.destCodigoPais,
    destNomePais: pedido.destNomePais,
    destTelefone: pedido.destTelefone,
    destIndIeDest: pedido.destIndIeDest,
    destIe: pedido.destIe,
    tenant: pedido.tenant,
    ...(pedido.pedidoMl ? { mlPackId: pedido.pedidoMl } : {}),
  };
}

/**
 * Normaliza desconto de linha para coluna monetária `Decimal` do Prisma.
 */
export function itemDiscountColumn(input: { desconto?: number }) {
  const desconto = Number(input.desconto ?? 0);
  return {
    desconto: Number.isFinite(desconto) && desconto > 0 ? Number(desconto.toFixed(2)) : 0,
  };
}

/**
 * Normaliza fretes do pedido para colunas monetárias `Decimal` do Prisma.
 */
export function orderFreightColumns(input: { freteConsumidor?: number; freteSeller?: number }) {
  return normalizeOrderFreight(input);
}

export function buyerToDestColumns(comprador: Buyer) {
  return {
    destCpf: comprador.cpf,
    destNome: comprador.nome,
    destLogradouro: comprador.logradouro,
    destNumero: comprador.numero,
    destComplemento: comprador.complemento,
    destBairro: comprador.bairro,
    destCodigoMunicipio: comprador.codigoMunicipio,
    destMunicipio: comprador.municipio,
    destUf: comprador.uf,
    destCep: comprador.cep,
    destCodigoPais: comprador.codigoPais,
    destNomePais: comprador.nomePais,
    destTelefone: comprador.telefone?.replace(/\D/g, "") || undefined,
    destIndIeDest: comprador.indIEDest,
    destIe: comprador.ie?.replace(/\D/g, "") || null,
  };
}
