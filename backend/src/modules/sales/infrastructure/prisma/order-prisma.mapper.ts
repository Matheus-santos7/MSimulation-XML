import type { PedidoStatus, Product } from "../../../../generated/prisma/client.js";
import { num } from "../../../fiscal-documents/presentation/mappers/fiscal-mappers.js";
import type { Buyer } from "../../domain/entities/buyer.entity.js";
import type { Order, OrderItemSummary } from "../../domain/entities/order.entity.js";
import type { OrderForEmit } from "../../domain/entities/order-for-emit.entity.js";

type PedidoItemRow = {
  id: string;
  productId: string;
  numeroItem: number;
  quantidade: number;
  desconto: { toString(): string };
  frete: { toString(): string };
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

function mapOrderItemFromRow(row: PedidoItemRow): OrderItemSummary {
  const unitPrice = num(row.product.preco);
  const desconto = num(row.desconto);
  const frete = num(row.frete);
  const valorTotalLinha = Math.round((unitPrice * row.quantidade + frete - desconto) * 100) / 100;

  return {
    id: row.id,
    productId: row.productId,
    quantidade: row.quantidade,
    desconto,
    frete,
    product: {
      id: row.product.id,
      sku: row.product.sku,
      nome: row.product.nome,
      preco: unitPrice,
    },
    valorTotalLinha,
  };
}

export function mapOrderFromPrisma(row: OrderRow): Order {
  const items = row.itens
    .slice()
    .sort((a, b) => a.numeroItem - b.numeroItem)
    .map(mapOrderItemFromRow);
  const valorTotal = Math.round(items.reduce((acc, item) => acc + item.valorTotalLinha, 0) * 100) / 100;

  return {
    id: row.id,
    tenantId: row.tenantId,
    status: row.status,
    pedidoMl: row.pedidoMl ?? undefined,
    items,
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
  const items = pedido.itens
    .slice()
    .sort((a, b) => a.numeroItem - b.numeroItem)
    .map((item) => {
      const desconto = num(item.desconto);
      const frete = num(item.frete);
      return {
        productId: item.productId,
        quantidade: item.quantidade,
        product: item.product,
        ...(frete > 0 ? { valorFrete: frete } : {}),
        ...(desconto > 0 ? { valorDesconto: desconto } : {}),
      };
    });

  return {
    tenantId: pedido.tenantId,
    items,
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
 * Normaliza desconto/frete vindos do payload de checkout em valores comerciais
 * (≥ 0 e arredondados em 2 casas) para colunas `Decimal` do Prisma.
 */
export function discountAndFreightColumns(input: { desconto?: number; frete?: number }) {
  const desconto = Number(input.desconto ?? 0);
  const frete = Number(input.frete ?? 0);
  return {
    desconto: Number.isFinite(desconto) && desconto > 0 ? Number(desconto.toFixed(2)) : 0,
    frete: Number.isFinite(frete) && frete > 0 ? Number(frete.toFixed(2)) : 0,
  };
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
