import type { PedidoStatus, Product } from "../../../../generated/prisma/client.js";
import { num } from "../../../fiscal-documents/presentation/mappers/fiscal-mappers.js";
import type { Buyer } from "../../domain/entities/buyer.entity.js";
import type { Order } from "../../domain/entities/order.entity.js";
import type { OrderForEmit } from "../../domain/entities/order-for-emit.entity.js";

type OrderRow = {
  id: string;
  tenantId: string;
  productId: string;
  quantidade: number;
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
  createdAt: Date;
  updatedAt: Date;
  product: Product;
  nfe?: {
    chave: string;
    numero: number;
    serie: number;
    status: string;
  } | null;
};

export function mapOrderFromPrisma(row: OrderRow): Order {
  const unitPrice = num(row.product.preco);
  return {
    id: row.id,
    tenantId: row.tenantId,
    status: row.status,
    pedidoMl: row.pedidoMl ?? undefined,
    productId: row.productId,
    quantidade: row.quantidade,
    product: {
      id: row.product.id,
      sku: row.product.sku,
      nome: row.product.nome,
      preco: unitPrice,
    },
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
    },
    valorTotal: unitPrice * row.quantidade,
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
  return {
    tenantId: pedido.tenantId,
    productId: pedido.productId,
    quantidade: pedido.quantidade,
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
    product: pedido.product,
    tenant: pedido.tenant,
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
  };
}
