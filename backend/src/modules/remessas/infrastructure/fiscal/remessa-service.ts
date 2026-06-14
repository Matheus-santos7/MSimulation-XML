/**
 * Orquestrador da NF-e de remessa física (depósito temporário / Full ML).
 *
 * Fluxo completo: docs/remessa-fisica.md | Módulo: modules/remessas/README.md
 *
 * Entrada pública:
 *  - `emitirRemessaManual` — módulo dedicado (POST /movimentacoes/remessa)
 *  - `emitirNFeRemessa` — atalho single-item (ex.: avanco-cd-service)
 *
 * Núcleo: `emitirNFeRemessaComItens` executa as fases 2–9 do documento.
 */
import {
  FiscalStatus,
  NFeTipo,
  OperacaoFiscalTipo,
  Prisma,
  type Product,
  type Tenant,
} from "../../../../generated/prisma/client.js";
import type { DbClient, PrismaTx } from "../../../../lib/db/prisma-tx.js";
import { runFiscalTransaction } from "../../../../lib/db/prisma-tx.js";
import { mapNfe } from "../../../fiscal-documents/presentation/mappers/fiscal-mappers.js";
import { buildChaveNFe, gerarPedidoMl } from "../../../fiscal-documents/domain/services/nfe-chave.js";
import { proximoNumeroNfe } from "../../../fiscal-documents/domain/services/nfe-sequencia.js";
import { REMESSA_NAT_OP, resolveRemessaCfop } from "./helpers/remessa-dest.js";
import type { UnidadeDestinoFiscal } from "../../../logistics/domain/services/meli-unidade.js";
import { enrichTaxSnapshot, loadEmitterSettings } from "../../../fiscal-settings/application/services/fiscal-emitter-runtime.js";
import { taxSnapshotFromRule } from "../../../tax/domain/services/tax-snapshot.js";
import {
  enrichFiscalPayloadMlFulfillment,
  enrichFiscalPayloadWithXTexto,
} from "@msimulation-xml/fiscal-core";
import { emitirCteRemessa } from "./cte-remessa-service.js";
import { productUnitPrice } from "@msimulation-xml/fiscal-core";
import {
  calcularImpostosNota,
  inferAliqIcmsRemessa,
  linhaPedidoFromProduto,
} from "../../../tax/index.js";
import { resolveTaxRule } from "../../../tax/index.js";
import {
  createLogisticsModule,
  findProductInTenant,
} from "../../../logistics/index.js";
import { persistNfeXmlAutorizado } from "../../../fiscal-documents/infrastructure/xml/nfe-xml-service.js";
import { realignRemessaFifoProductIdsBySku } from "../fifo/remessa-fifo.js";

export type EmitirRemessaOptions = {
  unidadeDestinoId?: string;
  pedidoMl?: string;
  observacaoAvanco?: string;
};

type RemessaLinhaInput = {
  product: Product;
  quantidade: number;
};

/** Atalho para remessa de um único produto; delega a `emitirNFeRemessaComItens`. */
export async function emitirNFeRemessa(
  db: DbClient,
  tenant: Tenant,
  product: Product,
  quantidade: number,
  options?: EmitirRemessaOptions,
) {
  if (quantidade < 1) {
    throw new RemessaError("Quantidade para remessa deve ser pelo menos 1");
  }
  return emitirNFeRemessaComItens(db, tenant, [{ product, quantidade }], options);
}

/**
 * Núcleo da emissão: resolve destino, tributos, persiste NF-e + itens + XML + CT-e.
 * Ver docs/remessa-fisica.md para mapa função-a-função.
 */
async function emitirNFeRemessaComItens(
  db: DbClient,
  tenant: Tenant,
  linhas: RemessaLinhaInput[],
  options?: EmitirRemessaOptions,
) {
  if (linhas.length === 0) {
    throw new RemessaError("Informe ao menos um produto na remessa");
  }

  // --- Fase 2: destinatário (CD ML) — define UF destino para regra e CFOP ---
  const logistics = createLogisticsModule(db);
  const destination = await logistics.resolveShipmentDestination.execute(
    tenant.id,
    options?.unidadeDestinoId,
  );
  const destino: UnidadeDestinoFiscal = destination.destinatarioFiscal;
  const unidade = {
    id: destination.unitId,
    codigo: destination.codigo,
    idCadIntTran: destination.idCadIntTran ?? null,
  };

  const emitterSettings = await loadEmitterSettings(db, tenant.id);
  const aliqFallback = inferAliqIcmsRemessa(tenant.uf, destino.uf, emitterSettings);
  const pedidoMl = options?.pedidoMl ?? gerarPedidoMl();

  // --- Fase 3: por item — regra tributária inbound + linha fiscal ---
  const linhasComRegras: { linha: ReturnType<typeof linhaPedidoFromProduto>; rule: NonNullable<Awaited<ReturnType<typeof resolveTaxRule>>> }[] = [];

  for (const [index, linha] of linhas.entries()) {
    // Remessa valoriza preço de custo (não preço de venda).
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

    // Planilha: {ruleBaseId}-taxpayer-inbound, colunas ICMS_{UF_DESTINO}_*.
    const remessaTaxRule = await resolveTaxRule(db, tenant.id, {
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

    // CFOP 5949 (mesma UF) ou 6949 (interestadual) — alinhado a idDest no XML.
    const cfopRemessa = resolveRemessaCfop(tenant.uf, destino.uf);
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

  // --- Fase 4: engine tributária (ICMS, PIS, COFINS, totais) ---
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

  // --- Fase 5: chave e numeração NF-e (série remessa do tenant) ---
  const serie = tenant.serieRemessa;
  const numero = await proximoNumeroNfe(db, tenant.id, serie);
  const chave = buildChaveNFe({ uf: tenant.uf, cnpj: tenant.cnpj, serie, numero });
  const emitidaEm = new Date();
  const destData = destinoToNfeFields(destino);

  // --- Fases 6–9: transação atômica (payload, NF-e, XML, CT-e) ---
  const { nfeRow, cteRow, itemRows } = await runFiscalTransaction(db, tenant.id, async (tx) => {
    // Fase 6: configurações do emissor + snapshot para XML/payload.
    const emitterSettings = await loadEmitterSettings(tx, tenant.id);
    const fiscalPayload = enrichFiscalPayloadMlFulfillment(
      enrichFiscalPayloadWithXTexto(
        {
          ...enrichTaxSnapshot(taxSnapshotFromRule(linhasComRegras[0]!.rule, aliqFallback, emitterSettings), {
            settings: emitterSettings,
            tipo: NFeTipo.REMESSA,
            valor,
            valorIcms,
            emitUf: tenant.uf,
            destUf: destino.uf,
            indFinal: 0,
          }),
          engine: nota,
          ...(destino.indIeDest === 1 && destino.ie
            ? { destIe: destino.ie.replace(/\D/g, "") }
            : {}),
        } as Record<string, unknown>,
        {
          tipo: NFeTipo.REMESSA,
          cfop: cfopHeader,
          natOp: REMESSA_NAT_OP,
          pedidoMl,
        },
      ),
      {
        quantidadeTotal,
        destIe: destino.ie,
        idCadIntTran: unidade?.idCadIntTran ?? null,
        withLogistics: true,
      },
    );

    // Fase 7: cabeçalho NF-e.
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
      // saldoDisponivel alimenta FIFO de vendas futuras (remessa-fifo.ts).
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

      await logistics.registerProductMovement.execute(
        {
          tenantId: tenant.id,
          productId: linha.product.id,
          tipoOperacao: OperacaoFiscalTipo.REMESSA,
          quantidade: linha.quantidade,
          unidadeDestinoId: unidade?.id ?? undefined,
          nfeId: nfeRow.id,
          observacao:
            options?.observacaoAvanco ??
            (unidade ? `Remessa item ${index + 1} para ${unidade.codigo}` : undefined),
        },
        tx,
      );
    }

    // Fase 8: XML autorizado (buildRemessaNFeXML via nfe-xml).
    await persistNfeXmlAutorizado(tx, {
      nfeId: nfeRow.id,
      tenant,
      nfeRow: { ...nfeRow, fiscalPayload },
      products: linhas.map((l) => l.product),
      itemRows,
      settings: emitterSettings,
    });

    // Fase 9: CT-e de transporte vinculado 1:1.
    const cteRow = await emitirCteRemessa(tx, tenant, nfeRow);
    return { nfeRow, cteRow, itemRows };
  });

  // Fase 10: DTO de resposta.
  return {
    nfe: mapNfe(nfeRow, undefined, itemRows),
    cte: cteRow,
  };
}

export type RemessaManualItemInput = {
  productId: string;
  productSku?: string;
  quantidade: number;
};

/**
 * Entrada do módulo dedicado de remessas (UI).
 * Carrega tenant e produtos; não altera estoque cadastral do produto.
 */
export async function emitirRemessaManual(
  db: DbClient,
  input: {
    tenantId: string;
    unidadeDestinoId: string;
    items: RemessaManualItemInput[];
  },
) {
  if (input.items.length === 0) {
    throw new RemessaError("Informe ao menos um produto na remessa");
  }

  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: input.tenantId } });

  const linhas: RemessaLinhaInput[] = [];
  for (const [index, item] of input.items.entries()) {
    const product = await findProductInTenant(db, input.tenantId, {
      productId: item.productId,
      sku: item.productSku,
    });
    if (!product) {
      const skuHint = item.productSku?.trim() ? ` (SKU ${item.productSku.trim()})` : "";
      throw new RemessaError(
        `Produto não encontrado (linha ${index + 1})${skuHint}. Confira o cadastro em Produtos.`,
      );
    }
    await realignRemessaFifoProductIdsBySku(db, input.tenantId, product.sku);
    if (item.quantidade < 1) {
      throw new RemessaError(`Quantidade inválida na linha ${index + 1}`);
    }
    linhas.push({ product, quantidade: item.quantidade });
  }

  return emitirNFeRemessaComItens(db, tenant, linhas, {
    unidadeDestinoId: input.unidadeDestinoId,
  });
}

/** Converte destino fiscal do CD para colunas `dest*` da tabela `nfes`. */
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
