/** Fixtures mínimas (como dono do banco, sem RLS) para as reproduções. */
import { randomUUID } from "node:crypto";
import { makePrisma } from "./db.js";

const owner = makePrisma("owner");
let nfeSeq = 0;

export function ownerDb() {
  return owner;
}

export async function seedProduct(tenantId: string, sku = `SKU-${randomUUID().slice(0, 8)}`) {
  return owner.product.create({
    data: { tenantId, sku, nome: `Produto ${sku}`, ncm: "61091000", origem: 0, unidade: "UN", preco: 10, precoCusto: 5 },
  });
}

export async function seedPedido(tenantId: string, productIds: string[]) {
  return owner.pedido.create({
    data: {
      tenantId,
      marketplace: "MERCADO_LIVRE",
      destCpf: "00000000191",
      destNome: "Consumidor",
      destLogradouro: "Rua C",
      destBairro: "Centro",
      destCodigoMunicipio: "3550308",
      destMunicipio: "São Paulo",
      destUf: "SP",
      destCep: "01001000",
      itens: { create: productIds.map((productId, i) => ({ productId, numeroItem: i + 1, quantidade: 1 } as never)) },
    } as never,
  });
}

export async function seedNfe(
  tenantId: string,
  opts: { productId?: string; tipo?: string; quantidade?: number; saldo?: number | null; status?: string; referenciaId?: string },
) {
  nfeSeq += 1;
  const chave = (String(Date.now()) + String(nfeSeq).padStart(6, "0")).padEnd(44, "7").slice(0, 44);

  return owner.nFe.create({
    data: {
      tenantId,
      productId: opts.productId,
      chave,
      numero: nfeSeq,
      serie: 5,
      natOp: "Teste",
      cfop: "5949",
      ncm: "61091000",
      destNome: "CD",
      destDoc: "00000000000191",
      destUf: "SP",
      valor: 100,
      valorIcms: 0,
      aliqIcms: 0,
      status: (opts.status ?? "AUTORIZADA") as never,
      emitidaEm: new Date(),
      pedidoMl: `PED-${nfeSeq}`,
      marketplace: "MERCADO_LIVRE",
      tipo: (opts.tipo ?? "REMESSA") as never,
      quantidade: opts.quantidade ?? 10,
      saldoDisponivel: opts.saldo === undefined ? null : opts.saldo,
      nfeReferenciaId: opts.referenciaId,
    } as never,
  });
}

export async function seedNfeItem(tenantId: string, nfeId: string, productId: string, quantidade: number, saldo: number | null) {
  return owner.nfeItem.create({
    data: { tenantId, nfeId, productId, numeroItem: 1, quantidade, valor: 100, valorIcms: 0, ncm: "61091000", cfop: "5949", saldoDisponivel: saldo } as never,
  });
}
