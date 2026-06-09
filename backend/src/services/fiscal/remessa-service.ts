/**
 * Emissão de NF-e de remessa física para depósito temporário (full).
 *
 * - Destinatário = unidade logística ML selecionada (planilha) ou fallback legado.
 * - Saldo FIFO por linha (`nfe_itens.saldo_disponivel`).
 * - Emite CT-e de remessa na mesma transação quando aplicável.
 */
import {
  FiscalStatus,
  NFeTipo,
  OperacaoFiscalTipo,
  Prisma,
  type PrismaClient,
  type Product,
  type Tenant,
} from "../../generated/prisma/client.js";
import { mapNfe } from "../../lib/fiscal-mappers.js";
import { buildChaveNFe, gerarPedidoMl } from "../../lib/nfe-chave.js";
import { proximoNumeroNfe } from "../../lib/nfe-sequencia.js";
import { REMESSA_CFOP, REMESSA_NAT_OP } from "../../lib/remessa-dest.js";
import type { UnidadeDestinoFiscal } from "../../lib/meli-unidade.js";
import { enrichTaxSnapshot, loadEmitterSettings } from "../../lib/fiscal-emitter-runtime.js";
import { taxSnapshotFromRule } from "../../lib/tax-snapshot.js";
import { enrichFiscalPayloadWithXTexto } from "@msimulation-xml/fiscal-core";
import { emitirCteRemessa } from "./cte-remessa-service.js";
import { productUnitPrice } from "@msimulation-xml/fiscal-core";
import {
  calcularImpostosNota,
  inferAliqIcmsRemessa,
  linhaPedidoFromProduto,
} from "./tax-calculation-service.js";
import { resolveTaxRule } from "./tax-rule-service.js";
import { UnidadeLogisticaService } from "../logistics/unidade-logistica-service.js";
import { registrarMovimentacaoProduto } from "../logistics/movimentacao-produto-service.js";
import { persistNfeXmlAutorizado } from "./nfe-xml-service.js";

export type EmitirRemessaOptions = {
  unidadeDestinoId?: string;
  pedidoMl?: string;
  observacaoAvanco?: string;
};

type RemessaLinhaInput = {
  product: Product;
  quantidade: number;
};

export async function emitirNFeRemessa(
  prisma: PrismaClient,
  tenant: Tenant,
  product: Product,
  quantidade: number,
  options?: EmitirRemessaOptions,
) {
  if (quantidade < 1) {
    throw new RemessaError("Quantidade para remessa deve ser pelo menos 1");
  }
  return emitirNFeRemessaComItens(prisma, tenant, [{ product, quantidade }], options);
}

async function emitirNFeRemessaComItens(
  prisma: PrismaClient,
  tenant: Tenant,
  linhas: RemessaLinhaInput[],
  options?: EmitirRemessaOptions,
) {
  if (linhas.length === 0) {
    throw new RemessaError("Informe ao menos um produto na remessa");
  }

  const unidadeService = new UnidadeLogisticaService(prisma);
  const { unidade, destino } = await unidadeService.resolveDestinoRemessa(
    tenant.id,
    options?.unidadeDestinoId,
  );

  const aliqFallback = inferAliqIcmsRemessa(tenant.uf, destino.uf);
  const pedidoMl = options?.pedidoMl ?? gerarPedidoMl();

  const linhasComRegras: { linha: ReturnType<typeof linhaPedidoFromProduto>; rule: NonNullable<Awaited<ReturnType<typeof resolveTaxRule>>> }[] = [];

  for (const [index, linha] of linhas.entries()) {
    const unitCusto = productUnitPrice(linha.product, "REMESSA");
    if (unitCusto <= 0) {
      throw new RemessaError(
        `Preço de custo não informado ou zero para "${linha.product.sku}". Informe o custo no cadastro do produto.`,
      );
    }

    const ruleBaseId = linha.product.taxRuleBaseId?.trim();
    if (!ruleBaseId) {
      throw new RemessaError(
        `Produto "${linha.product.sku}" sem regra fiscal. Edite o cadastro e selecione a regra da planilha.`,
      );
    }

    const remessaTaxRule = await resolveTaxRule(prisma, tenant.id, {
      originUf: tenant.uf,
      destinationUf: destino.uf,
      transactionType: "inbound",
      customerType: "taxpayer",
      ruleBaseId,
    });
    if (!remessaTaxRule) {
      throw new RemessaError(
        `Regra "${ruleBaseId}" sem linha de remessa (origem ${tenant.uf} → ${destino.uf}) para "${linha.product.sku}".`,
      );
    }

    const cfopRemessa = remessaTaxRule.cfop?.trim() || REMESSA_CFOP;
    linhasComRegras.push({
      linha: {
        ...linhaPedidoFromProduto(linha.product, {
          cfop: cfopRemessa,
          quantidade: linha.quantidade,
          valorUnitario: unitCusto,
        }),
        numeroItem: index + 1,
      },
      rule: remessaTaxRule,
    });
  }

  const nota = calcularImpostosNota(
    linhasComRegras,
    { ufOrigem: tenant.uf, ufDestino: destino.uf, customerType: "taxpayer" },
    aliqFallback,
  );

  const valor = nota.totais.vNF;
  const valorIcms = nota.totais.vICMS;
  const quantidadeTotal = linhas.reduce((acc, l) => acc + l.quantidade, 0);
  const primeiro = linhas[0]!.product;
  const cfopHeader = linhasComRegras[0]!.linha.cfop;
  const aliqIcms = valor > 0 ? Math.round((valorIcms / valor) * 10000) / 100 : aliqFallback;

  const serie = tenant.serieRemessa;
  const numero = await proximoNumeroNfe(prisma, tenant.id, serie);
  const chave = buildChaveNFe({ uf: tenant.uf, cnpj: tenant.cnpj, serie, numero });
  const emitidaEm = new Date();
  const destData = destinoToNfeFields(destino);

  const { nfeRow, cteRow, itemRows } = await prisma.$transaction(async (tx) => {
    const emitterSettings = await loadEmitterSettings(tx, tenant.id);
    const fiscalPayload = enrichFiscalPayloadWithXTexto(
      {
        ...enrichTaxSnapshot(taxSnapshotFromRule(linhasComRegras[0]!.rule, aliqFallback), {
          settings: emitterSettings,
          tipo: NFeTipo.REMESSA,
          valor,
          valorIcms,
          emitUf: tenant.uf,
          destUf: destino.uf,
          indFinal: 0,
        }),
        engine: nota,
      } as Record<string, unknown>,
      {
        tipo: NFeTipo.REMESSA,
        cfop: cfopHeader,
        natOp: REMESSA_NAT_OP,
        pedidoMl,
      },
    );

    const nfeRow = await tx.nFe.create({
      data: {
        tenantId: tenant.id,
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
        unidadeDestinoId: unidade?.id ?? undefined,
        fiscalPayload: fiscalPayload as Prisma.InputJsonValue,
      },
    });

    const itemRows = [];
    for (const [index, linha] of linhas.entries()) {
      const engineItem = nota.itens[index];
      if (!engineItem) {
        throw new RemessaError(`Falha ao calcular item ${index + 1} da remessa`);
      }
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
          cfop: linhasComRegras[index]!.linha.cfop,
          saldoDisponivel: linha.quantidade,
        },
        include: { product: true },
      });
      itemRows.push(itemRow);

      await registrarMovimentacaoProduto(tx, {
        tenantId: tenant.id,
        productId: linha.product.id,
        tipoOperacao: OperacaoFiscalTipo.REMESSA,
        quantidade: linha.quantidade,
        unidadeDestinoId: unidade?.id ?? undefined,
        nfeId: nfeRow.id,
        observacao:
          options?.observacaoAvanco ??
          (unidade ? `Remessa item ${index + 1} para ${unidade.codigo}` : undefined),
      });
    }

    await persistNfeXmlAutorizado(tx, {
      nfeId: nfeRow.id,
      tenant,
      nfeRow: { ...nfeRow, fiscalPayload },
      products: linhas.map((l) => l.product),
      itemRows,
      settings: emitterSettings,
    });

    const cteRow = await emitirCteRemessa(tx, tenant, nfeRow);
    return { nfeRow, cteRow, itemRows };
  });

  return {
    nfe: mapNfe(nfeRow, undefined, itemRows),
    cte: cteRow,
  };
}

export type RemessaManualItemInput = {
  productId: string;
  quantidade: number;
};

/** Remessa física manual (UI de fulfillment), sem alterar estoque do produto. */
export async function emitirRemessaManual(
  prisma: PrismaClient,
  input: {
    tenantId: string;
    unidadeDestinoId: string;
    items: RemessaManualItemInput[];
  },
) {
  if (input.items.length === 0) {
    throw new RemessaError("Informe ao menos um produto na remessa");
  }

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: input.tenantId } });
  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { tenantId: input.tenantId, id: { in: productIds } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const linhas: RemessaLinhaInput[] = [];
  for (const [index, item] of input.items.entries()) {
    const product = byId.get(item.productId);
    if (!product) {
      throw new RemessaError(`Produto não encontrado (linha ${index + 1})`);
    }
    if (item.quantidade < 1) {
      throw new RemessaError(`Quantidade inválida na linha ${index + 1}`);
    }
    linhas.push({ product, quantidade: item.quantidade });
  }

  return emitirNFeRemessaComItens(prisma, tenant, linhas, {
    unidadeDestinoId: input.unidadeDestinoId,
  });
}

function destinoToNfeFields(destino: UnidadeDestinoFiscal) {
  return {
    destNome: destino.nome,
    destDoc: destino.cnpj,
    destUf: destino.uf,
    destLogradouro: destino.logradouro,
    destNumero: destino.numero,
    destComplemento: destino.complemento,
    destBairro: destino.bairro,
    destCodigoMunicipio: destino.codigoMunicipio,
    destMunicipio: destino.municipio,
    destCep: destino.cep,
    destCodigoPais: destino.codigoPais,
    destNomePais: destino.nomePais,
    destIndIeDest: destino.indIeDest,
  };
}

export class RemessaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RemessaError";
  }
}
