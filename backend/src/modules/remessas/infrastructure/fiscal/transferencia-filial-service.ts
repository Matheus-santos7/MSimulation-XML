/**
 * Orquestrador da transferência entre filiais + remessa automática ao CD padrão.
 *
 * Fluxo:
 * 1. Matriz emite NF-e TRANSFERENCIA_FILIAL (CFOP 5152/6152) para a filial cadastrada.
 * 2. Filial emite remessa física automática ao CD padrão (regra inbound por origem filial × produto).
 */
import {
  FiscalStatus,
  NFeTipo,
  OperacaoFiscalTipo,
  Prisma,
  type Product,
  type Tenant,
  type TenantFilial,
} from "../../../../generated/prisma/client.js";
import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import { runFiscalTransaction } from "../../../../lib/db/prisma-tx.js";
import { mapNfe } from "../../../fiscal-documents/presentation/mappers/fiscal-mappers.js";
import { buildChaveNFe, gerarPedidoMl } from "../../../fiscal-documents/domain/services/nfe-chave.js";
import { proximoNumeroNfe } from "../../../fiscal-documents/domain/services/nfe-sequencia.js";
import { enrichTaxSnapshot, loadEmitterSettings } from "../../../fiscal-settings/application/services/fiscal-emitter-runtime.js";
import { taxSnapshotFromRule } from "../../../tax/domain/services/tax-snapshot.js";
import {
  enrichFiscalPayloadMlFulfillment,
  enrichFiscalPayloadWithXTexto,
  resolveNumeroInicialNfe,
} from "@msimulation-xml/fiscal-core";
import { productUnitPrice } from "@msimulation-xml/fiscal-core";
import {
  calcularImpostosNota,
  inferAliqIcmsRemessa,
  linhaPedidoFromProduto,
  resolveTaxRule,
} from "../../../tax/index.js";
import { createLogisticsModule, findProductInTenant } from "../../../logistics/index.js";
import { persistNfeXmlAutorizado } from "../../../fiscal-documents/infrastructure/xml/nfe-xml-service.js";
import { mapEmitenteFromFilial } from "../../../org/infrastructure/fiscal/tenant-emitente.mapper.js";
import {
  EmitenteFiscalConfigError,
  resolveEmitenteFiscal,
  resolveTransferenciaEmitenteId,
} from "../../../org/index.js";
import { realignRemessaFifoProductIdsBySku } from "../fifo/remessa-fifo.js";
import {
  TRANSFERENCIA_FILIAL_NAT_OP,
  destinoFiscalToNfeFields,
  filialParaDestinoFiscal,
  resolveTransferenciaCfop,
} from "./helpers/transferencia-filial-dest.js";
import { RemessaError, emitirRemessaComItens } from "./remessa-service.js";
import type { EmitenteEmissaoOverride } from "./emitente-emissao-override.js";
import { chaveEmissaoFromOverride } from "./emitente-emissao-override.js";

export type TransferenciaFilialItemInput = {
  productId: string;
  productSku?: string;
  quantidade: number;
};

type LinhaInput = { product: Product; quantidade: number };

export class TransferenciaFilialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransferenciaFilialError";
  }
}

async function carregarFilial(db: DbClient, tenantId: string, filialId: string): Promise<TenantFilial> {
  const filial = await db.tenantFilial.findFirst({
    where: { id: filialId, tenantId },
  });
  if (!filial) {
    throw new TransferenciaFilialError("Filial não encontrada. Cadastre a filial em Empresas → Filiais.");
  }
  return filial;
}

async function resolverCdPadraoFilial(
  db: DbClient,
  tenantId: string,
  filial: TenantFilial,
): Promise<string> {
  if (filial.unidadeLogisticaPadraoId) {
    const link = await db.tenantUnidadeLogistica.findFirst({
      where: {
        tenantId,
        unidadeId: filial.unidadeLogisticaPadraoId,
        unidade: { ativa: true },
      },
    });
    if (!link) {
      throw new TransferenciaFilialError(
        "CD padrão da filial não está vinculado à matriz. Revise o cadastro da filial ou defina o CD padrão em Unidades ML.",
      );
    }
    return filial.unidadeLogisticaPadraoId;
  }

  const logistics = createLogisticsModule();
  const destino = await logistics.resolveShipmentDestination.execute(tenantId);
  return destino.unitId;
}

async function validarRegraProduto(
  db: DbClient,
  tenantId: string,
  product: Product,
  originUf: string,
  destinationUf: string,
  contexto: string,
): Promise<NonNullable<Awaited<ReturnType<typeof resolveTaxRule>>>> {
  const ruleBaseId = product.taxRuleBaseId?.trim();
  if (!ruleBaseId) {
    throw new TransferenciaFilialError(
      `Produto "${product.sku}" sem regra fiscal. Edite o cadastro e selecione a regra da planilha.`,
    );
  }

  const rule = await resolveTaxRule(db, tenantId, {
    originUf,
    destinationUf,
    transactionType: "inbound",
    customerType: "taxpayer",
    ruleBaseId,
  });
  if (!rule) {
    throw new TransferenciaFilialError(
      `Regra "${ruleBaseId}" sem linha inbound (${contexto}) para ${originUf} → ${destinationUf} no produto "${product.sku}". Importe ou revise a planilha.`,
    );
  }
  return rule;
}

async function validarMatrizDistintaDaFilialDestino(
  tenant: Tenant,
  filialDestino: TenantFilial,
  matrizEmitente: EmitenteEmissaoOverride,
): Promise<void> {
  const transferenciaEmitenteId = resolveTransferenciaEmitenteId(tenant);
  if (transferenciaEmitenteId && transferenciaEmitenteId === filialDestino.id) {
    throw new TransferenciaFilialError(
      `A filial "${filialDestino.nomeFantasia}" é o emitente de transferências e não pode ser destino. Selecione a filial operacional que receberá o estoque.`,
    );
  }

  const matrizCnpj = matrizEmitente.cnpj.replace(/\D/g, "");
  const destCnpj = filialDestino.cnpj.replace(/\D/g, "");
  if (matrizCnpj === destCnpj) {
    throw new TransferenciaFilialError(
      `O emitente de transferência (CNPJ ${matrizCnpj}) coincide com a filial destino "${filialDestino.nomeFantasia}". Selecione outra filial ou revise os papéis em Empresas.`,
    );
  }
}

async function validarPreRequisitos(
  db: DbClient,
  tenant: Tenant,
  filial: TenantFilial,
  linhas: LinhaInput[],
  unidadeDestinoId: string,
  cdUf: string,
  matrizUf: string,
): Promise<void> {
  if (!filial.serieRemessa || filial.serieRemessa < 1) {
    throw new TransferenciaFilialError(
      `Filial "${filial.nomeFantasia}" sem série de remessa configurada. Edite o cadastro da filial.`,
    );
  }

  const destinoFilial = filialParaDestinoFiscal(filial);

  for (const linha of linhas) {
    const unitCusto = productUnitPrice(linha.product, "REMESSA");
    if (unitCusto <= 0) {
      throw new TransferenciaFilialError(
        `Preço de custo não informado ou zero para "${linha.product.sku}". Informe o custo no cadastro do produto.`,
      );
    }
    await validarRegraProduto(
      db,
      tenant.id,
      linha.product,
      matrizUf,
      destinoFilial.uf,
      "transferência matriz → filial",
    );
    await validarRegraProduto(
      db,
      tenant.id,
      linha.product,
      filial.uf,
      cdUf,
      "remessa filial → CD",
    );
  }
}

async function emitirNFeTransferenciaComItens(
  db: DbClient,
  tenant: Tenant,
  filial: TenantFilial,
  linhas: LinhaInput[],
  pedidoMl: string,
  matrizEmitente: EmitenteEmissaoOverride,
) {
  const destino = filialParaDestinoFiscal(filial);
  const destData = destinoFiscalToNfeFields(destino);
  const matrizUf = matrizEmitente.uf;
  const emitterSettings = await loadEmitterSettings(db, tenant.id);
  const aliqFallback = inferAliqIcmsRemessa(matrizUf, destino.uf, emitterSettings);

  const linhasComRegras: {
    linha: ReturnType<typeof linhaPedidoFromProduto>;
    rule: NonNullable<Awaited<ReturnType<typeof resolveTaxRule>>>;
  }[] = [];

  for (const [index, linha] of linhas.entries()) {
    const unitCusto = productUnitPrice(linha.product, "REMESSA");
    const ruleBaseId = linha.product.taxRuleBaseId!.trim();
    const taxRule = await resolveTaxRule(db, tenant.id, {
      originUf: matrizUf,
      destinationUf: destino.uf,
      transactionType: "inbound",
      customerType: "taxpayer",
      ruleBaseId,
    });
    if (!taxRule) {
      throw new TransferenciaFilialError(`Regra fiscal ausente para "${linha.product.sku}".`);
    }

    const cfop = resolveTransferenciaCfop(matrizUf, destino.uf);
    linhasComRegras.push({
      linha: {
        ...linhaPedidoFromProduto(linha.product, {
          cfop,
          quantidade: linha.quantidade,
          valorUnitario: unitCusto,
        }),
        numeroItem: index + 1,
      },
      rule: taxRule,
    });
  }

  const nota = calcularImpostosNota(
    linhasComRegras,
    { ufOrigem: matrizUf, ufDestino: destino.uf, customerType: "taxpayer" },
    aliqFallback,
  );

  const valor = nota.totais.vNF;
  const valorIcms = nota.totais.vICMS;
  const quantidadeTotal = linhas.reduce((acc, l) => acc + l.quantidade, 0);
  const primeiro = linhas[0]!.product;
  const cfopHeader = linhasComRegras[0]!.linha.cfop;
  const aliqIcms = valor > 0 ? Math.round((valorIcms / valor) * 10000) / 100 : aliqFallback;

  const chaveParams = chaveEmissaoFromOverride(matrizEmitente);
  const serie = chaveParams.serie;
  const numeroInicial = resolveNumeroInicialNfe(emitterSettings, serie, {
    serieRemessa: tenant.serieRemessa,
    serieTransferencia: tenant.serieTransferencia,
  });
  const numero = await proximoNumeroNfe(db, tenant.id, serie, numeroInicial);
  const chave = buildChaveNFe({ uf: chaveParams.uf, cnpj: chaveParams.cnpj, serie, numero });
  const emitidaEm = new Date();
  const logistics = createLogisticsModule();

  const { nfeRow, itemRows } = await runFiscalTransaction(db, tenant.id, async (tx) => {
    const fiscalPayload = enrichFiscalPayloadMlFulfillment(
      enrichFiscalPayloadWithXTexto(
        {
          ...enrichTaxSnapshot(taxSnapshotFromRule(linhasComRegras[0]!.rule, aliqFallback, emitterSettings), {
            settings: emitterSettings,
            tipo: NFeTipo.TRANSFERENCIA_FILIAL,
            valor,
            valorIcms,
            emitUf: matrizUf,
            destUf: destino.uf,
            indFinal: 0,
          }),
          engine: nota,
          destIe: destino.ie,
        } as Record<string, unknown>,
        {
          tipo: NFeTipo.TRANSFERENCIA_FILIAL,
          cfop: cfopHeader,
          natOp: TRANSFERENCIA_FILIAL_NAT_OP,
          pedidoMl,
        },
      ),
      { quantidadeTotal, destIe: destino.ie, withLogistics: false },
    );
    const fiscalPayloadWithEmit = {
      ...fiscalPayload,
      emitSnapshot: matrizEmitente.emitSnapshot,
    };

    const nfeRow = await tx.nFe.create({
      data: {
        tenantId: tenant.id,
        productId: linhas.length === 1 ? primeiro.id : null,
        chave,
        numero,
        serie,
        natOp: TRANSFERENCIA_FILIAL_NAT_OP,
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
        tipo: NFeTipo.TRANSFERENCIA_FILIAL,
        saldoDisponivel: null,
        fiscalPayload: fiscalPayloadWithEmit as Prisma.InputJsonValue,
      },
    });

    const itemRows = [];
    for (const [index, linha] of linhas.entries()) {
      const engineItem = nota.itens[index];
      if (!engineItem) {
        throw new TransferenciaFilialError(`Falha ao calcular item ${index + 1} da transferência`);
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
          saldoDisponivel: null,
        },
        include: { product: true },
      });
      itemRows.push(itemRow);

      await logistics.registerProductMovement.execute(
        {
          tenantId: tenant.id,
          productId: linha.product.id,
          tipoOperacao: OperacaoFiscalTipo.TRANSFERENCIA_FILIAL,
          quantidade: linha.quantidade,
          nfeId: nfeRow.id,
          observacao: `Transferência matriz → filial ${filial.cnpj}`,
        },
        tx,
      );
    }

    await persistNfeXmlAutorizado(tx, {
      nfeId: nfeRow.id,
      tenant,
      nfeRow: { ...nfeRow, fiscalPayload: fiscalPayloadWithEmit },
      products: linhas.map((l) => l.product),
      itemRows,
      settings: emitterSettings,
    });

    return { nfeRow, itemRows };
  });

  return { nfe: mapNfe(nfeRow, undefined, itemRows), id: nfeRow.id };
}

function buildEmitenteOverride(filial: TenantFilial): EmitenteEmissaoOverride {
  const emitSnapshot = mapEmitenteFromFilial(filial);
  return {
    uf: filial.uf.toUpperCase(),
    cnpj: filial.cnpj.replace(/\D/g, ""),
    serie: filial.serieRemessa,
    emitSnapshot,
  };
}

export async function emitirTransferenciaFilial(
  db: DbClient,
  input: {
    tenantId: string;
    filialId: string;
    items: TransferenciaFilialItemInput[];
  },
) {
  if (input.items.length === 0) {
    throw new TransferenciaFilialError("Informe ao menos um produto na transferência");
  }

  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: input.tenantId } });
  const filial = await carregarFilial(db, input.tenantId, input.filialId);

  const linhas: LinhaInput[] = [];
  for (const [index, item] of input.items.entries()) {
    const product = await findProductInTenant(db, input.tenantId, {
      productId: item.productId,
      sku: item.productSku,
    });
    if (!product) {
      const skuHint = item.productSku?.trim() ? ` (SKU ${item.productSku.trim()})` : "";
      throw new TransferenciaFilialError(
        `Produto não encontrado (linha ${index + 1})${skuHint}. Confira o cadastro em Produtos.`,
      );
    }
    await realignRemessaFifoProductIdsBySku(db, input.tenantId, product.sku);
    if (item.quantidade < 1) {
      throw new TransferenciaFilialError(`Quantidade inválida na linha ${index + 1}`);
    }
    linhas.push({ product, quantidade: item.quantidade });
  }

  const matrizEmitente = await resolveEmitenteFiscal(db, tenant, "matriz");
  await validarMatrizDistintaDaFilialDestino(tenant, filial, matrizEmitente);
  const unidadeDestinoId = await resolverCdPadraoFilial(db, input.tenantId, filial);
  const logistics = createLogisticsModule();
  const cdDestino = await logistics.resolveShipmentDestination.execute(input.tenantId, unidadeDestinoId);
  await validarPreRequisitos(
    db,
    tenant,
    filial,
    linhas,
    unidadeDestinoId,
    cdDestino.uf,
    matrizEmitente.uf,
  );

  const pedidoMl = gerarPedidoMl();
  const transferenciaRow = await emitirNFeTransferenciaComItens(
    db,
    tenant,
    filial,
    linhas,
    pedidoMl,
    matrizEmitente,
  );

  const remessaResult = await emitirRemessaComItens(db, tenant, linhas, {
    unidadeDestinoId,
    pedidoMl,
    emitenteOverride: buildEmitenteOverride(filial),
    observacaoAvanco: `Remessa automática pós-transferência filial ${filial.cnpj}`,
    nfeReferenciaId: transferenciaRow.id,
  });

  return {
    transferencia: transferenciaRow.nfe,
    remessa: remessaResult.nfe,
    cte: remessaResult.cte,
    totalItens: linhas.length,
    filial: {
      id: filial.id,
      cnpj: filial.cnpj,
      uf: filial.uf,
      serieRemessa: filial.serieRemessa,
    },
    unidadeDestinoId,
  };
}

export { RemessaError, EmitenteFiscalConfigError };
