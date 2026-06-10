import { enrichFiscalPayloadWithXTexto, productUnitPrice } from "@msimulation-xml/fiscal-core";
import { NFeTipo, type PrismaClient } from "../../../../generated/prisma/client.js";
import { buildChaveNFe } from "../../../../lib/fiscal/nfe-chave.js";
import { enrichTaxSnapshot, loadEmitterSettings } from "../../../../lib/fiscal/fiscal-emitter-runtime.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import {
  RETORNO_SIMBOLICO_CFOP,
  RETORNO_SIMBOLICO_NAT_OP,
} from "../../../../lib/fiscal/retorno-simbolico-dest.js";
import { unidadeParaDestinoFiscal } from "../../../../lib/logistics/meli-unidade.js";
import { taxSnapshotFromRule } from "../../../../lib/fiscal/tax-snapshot.js";
import { proximoNumeroNfe } from "../../../../lib/fiscal/nfe-sequencia.js";
import { enderecoDestRetorno } from "../../../../services/fiscal/venda/chain/context.js";
import {
  calcularNotaInbound,
  inferAliqIcmsRemessa,
  linhaPedidoFromProduto,
} from "../../../../services/fiscal/tax/tax-calculation-service.js";
import { resolveTaxRule } from "../../../../services/fiscal/tax/tax-rule-service.js";
import { prepararRemessaSimbolicaFiscal } from "../../../../services/fiscal/remessa/remessa-simbolica-fiscal.js";
import { getUnidadeAtivaDoTenant } from "../../../../services/logistics/unidade-logistica-service.js";
import type { CamposDestinoNfe } from "../../domain/types/destino-nfe.js";
import type {
  ContextoFiscalEmissao,
  DocumentoFiscalPreparado,
  EmissorNotaPort,
} from "../../domain/ports/emissor-nota-port.js";
import { criarRetornoSimbolicoAvanco, criarRemessaSimbolicaAvanco } from "../../domain/entities/nota-fiscal.js";
import { RemessaDomainError } from "../../domain/errors.js";

type Db = PrismaClient | PrismaTx;

function destinoFiscalParaCampos(destino: ReturnType<typeof unidadeParaDestinoFiscal>): CamposDestinoNfe {
  return {
    destNome: destino.nome,
    destDoc: destino.cnpj,
    destUf: destino.uf,
    destLogradouro: destino.logradouro,
    destNumero: destino.numero,
    destComplemento: destino.complemento ?? null,
    destBairro: destino.bairro,
    destCodigoMunicipio: destino.codigoMunicipio,
    destMunicipio: destino.municipio,
    destCep: destino.cep,
    destCodigoPais: destino.codigoPais,
    destNomePais: destino.nomePais,
    destIndIeDest: destino.indIeDest,
  };
}

export class FiscalEmissorAdapter implements EmissorNotaPort {
  constructor(private readonly db: Db) {}

  async prepararRetornoSimbolicoAvanco(
    tx: PrismaTx,
    ctx: ContextoFiscalEmissao,
    quantidade: number,
    remessaReferencia: { id: string; chave: string },
    unidadeOrigemId: string,
  ): Promise<DocumentoFiscalPreparado> {
    const { tenant, product } = ctx;
    const unitCusto = productUnitPrice(product, "REMESSA");
    if (unitCusto <= 0) {
      throw new RemessaDomainError(
        "Preço de custo não informado ou zero. Informe o custo no cadastro do produto.",
      );
    }

    const ruleBaseId = product.taxRuleBaseId?.trim();
    if (!ruleBaseId) {
      throw new RemessaDomainError(
        "Produto sem regra fiscal associada. Edite o cadastro e selecione a regra da planilha.",
      );
    }

    const inboundTaxRule = await resolveTaxRule(tx, tenant.id, {
      originUf: tenant.uf,
      destinationUf: tenant.uf,
      transactionType: "inbound",
      customerType: "taxpayer",
      ruleBaseId,
    });
    if (!inboundTaxRule) {
      throw new RemessaDomainError(
        `Regra "${ruleBaseId}" sem linha inbound para retorno simbólico.`,
      );
    }

    const numero = await proximoNumeroNfe(tx, tenant.id, ctx.serie);
    const chave = buildChaveNFe({
      uf: tenant.uf,
      cnpj: tenant.cnpj,
      serie: ctx.serie,
      numero,
    });

    const aliqFallback = inferAliqIcmsRemessa(tenant.uf, tenant.uf);
    const cfop = inboundTaxRule.cfop ?? RETORNO_SIMBOLICO_CFOP;
    const calc = calcularNotaInbound(
      linhaPedidoFromProduto(product, {
        cfop,
        quantidade,
        valorUnitario: unitCusto,
      }),
      inboundTaxRule,
      tenant.uf,
      tenant.uf,
      aliqFallback,
    );

    const emitterSettings = await loadEmitterSettings(tx, tenant.id);
    const fiscalPayload = enrichFiscalPayloadWithXTexto(
      {
        ...enrichTaxSnapshot(taxSnapshotFromRule(inboundTaxRule, aliqFallback), {
          settings: emitterSettings,
          tipo: NFeTipo.RETORNO_SIMBOLICO,
          valor: calc.valor,
          valorIcms: calc.valorIcms,
          emitUf: tenant.uf,
          destUf: tenant.uf,
          indFinal: 0,
        }),
        engine: calc.nota,
      } as Record<string, unknown>,
      {
        tipo: NFeTipo.RETORNO_SIMBOLICO,
        cfop,
        natOp: RETORNO_SIMBOLICO_NAT_OP,
        pedidoMl: ctx.pedidoMl,
      },
    );

    const remessaPai = await tx.nFe.findUniqueOrThrow({
      where: { id: remessaReferencia.id },
      select: { id: true, chave: true, tipo: true },
    });

    const rascunho = criarRetornoSimbolicoAvanco(
      {
        tenantId: tenant.id,
        productId: product.id,
        serie: ctx.serie,
        quantidade,
        unidadeOrigemId,
        unidadeDestinoId: null,
      },
      { id: remessaPai.id, chave: remessaPai.chave, tipo: "REMESSA" },
    );

    return {
      rascunho,
      numero,
      chave,
      natOp: RETORNO_SIMBOLICO_NAT_OP,
      cfop,
      valor: calc.valor,
      valorIcms: calc.valorIcms,
      aliqIcms: calc.aliqIcms,
      fiscalPayload,
      destino: enderecoDestRetorno(tenant),
    };
  }

  async prepararRemessaSimbolicaAvanco(
    tx: PrismaTx,
    ctx: ContextoFiscalEmissao,
    quantidade: number,
    retornoReferencia: { id: string; chave: string },
    unidadeOrigemId: string,
    unidadeDestinoId: string,
  ): Promise<DocumentoFiscalPreparado> {
    const unidade = await getUnidadeAtivaDoTenant(
      tx as unknown as PrismaClient,
      ctx.tenant.id,
      unidadeDestinoId,
    );
    if (!unidade) {
      throw new RemessaDomainError("CD destino não encontrado ou inativo");
    }

    const destino = unidadeParaDestinoFiscal(unidade);
    const fiscal = await prepararRemessaSimbolicaFiscal(tx, {
      tenantId: ctx.tenant.id,
      emitUf: ctx.emitUf,
      destUf: destino.uf,
      product: ctx.product,
      quantidade,
      pedidoMl: ctx.pedidoMl,
    });

    const numero = await proximoNumeroNfe(tx, ctx.tenant.id, ctx.serie);
    const chave = buildChaveNFe({
      uf: ctx.tenant.uf,
      cnpj: ctx.tenant.cnpj,
      serie: ctx.serie,
      numero,
    });

    const retornoPai = await tx.nFe.findUniqueOrThrow({
      where: { id: retornoReferencia.id },
      select: { id: true, chave: true, tipo: true },
    });

    const rascunho = criarRemessaSimbolicaAvanco(
      {
        tenantId: ctx.tenant.id,
        productId: ctx.product.id,
        serie: ctx.serie,
        quantidade,
        unidadeOrigemId,
        unidadeDestinoId,
      },
      { id: retornoPai.id, chave: retornoPai.chave, tipo: "RETORNO_SIMBOLICO" },
    );

    return {
      rascunho,
      numero,
      chave,
      natOp: fiscal.natOp,
      cfop: fiscal.cfop,
      valor: fiscal.calc.valor,
      valorIcms: fiscal.calc.valorIcms,
      aliqIcms: fiscal.calc.aliqIcms,
      fiscalPayload: fiscal.fiscalPayload,
      destino: destinoFiscalParaCampos(destino),
    };
  }
}
