import {
  enrichFiscalPayloadMlFulfillment,
  enrichFiscalPayloadWithXTexto,
  productUnitPrice,
  resolveNumeroInicialNfe,
} from "@msimulation-xml/fiscal-core";
import { NFeTipo, PrismaClient } from "../../../../generated/prisma/client.js";
import { buildChaveNFe } from "../../../fiscal-documents/domain/services/nfe-chave.js";
import { enrichTaxSnapshot, loadEmitterSettings } from "../../../fiscal-settings/application/services/fiscal-emitter-runtime.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import {
  destIeRetornoFromRemessa,
  destinoRetornoFromRemessa,
  resolveRetornoSimbolicoCfop,
  RETORNO_SIMBOLICO_NAT_OP,
} from "../../domain/services/retorno-simbolico-dest.js";
import { unidadeParaDestinoFiscal } from "../../../logistics/domain/services/meli-unidade.js";
import { taxSnapshotFromRule } from "../../../tax/domain/services/tax-snapshot.js";
import { proximoNumeroNfe } from "../../../fiscal-documents/domain/services/nfe-sequencia.js";
import { loadRemessaForReturnDestination } from "../fifo/remessa-fifo.js";
import {
  calculateInboundInvoice,
  resolveIcmsFallbackRate,
  orderLineFromProduct,
} from "../../../tax/index.js";
import { resolveTaxRule } from "../../../tax/index.js";
import { prepareSymbolicShipmentFiscal } from "./symbolic-shipment/index.js";
import { findActiveLogisticsUnitRecord } from "../../../logistics/index.js";
import type { CamposDestinoNfe } from "../../domain/types/destino-nfe.js";
import type {
  ContextoFiscalEmissao,
  DocumentoFiscalPreparado,
  EmissorNotaPort,
} from "../../domain/ports/emissor-nota-port.js";
import { criarRetornoSimbolicoAvanco, criarRemessaAvanco } from "../../domain/entities/nota-fiscal.js";
import { RemessaDomainError } from "../../domain/errors.js";

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
  async prepararRetornoSimbolicoAvanco(
    tx: PrismaTx,
    ctx: ContextoFiscalEmissao,
    quantidade: number,
    remessaReferencia: { id: string; chave: string },
    unidadeOrigemId: string,
    unidadeDestinoId: string,
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

    const remessaPai = await loadRemessaForReturnDestination(tx, remessaReferencia.id);
    const destinoRetorno = destinoRetornoFromRemessa(remessaPai, remessaPai.unidadeDestino);
    const { destTelefone: _destTelefone, ...destino } = destinoRetorno;
    const destUf = destinoRetorno.destUf;
    const destIe = destIeRetornoFromRemessa(remessaPai, remessaPai.unidadeDestino);
    const idCadIntTran = remessaPai.unidadeDestino?.idCadIntTran?.trim() || null;

    const inboundTaxRule = await resolveTaxRule(tx, tenant.id, {
      originUf: tenant.uf,
      destinationUf: destUf,
      transactionType: "inbound",
      customerType: "taxpayer",
      ruleBaseId,
    });
    if (!inboundTaxRule) {
      throw new RemessaDomainError(
        `Regra "${ruleBaseId}" sem linha inbound (envio de estoque) para retorno simbólico (${tenant.uf} → ${destUf}).`,
      );
    }

    const emitterSettings = await loadEmitterSettings(tx, tenant.id);
    const numeroInicial = resolveNumeroInicialNfe(emitterSettings, ctx.serie, {
      serieRemessa: tenant.serieRemessa,
      serieTransferencia: tenant.serieTransferencia,
    });
    const numero = await proximoNumeroNfe(tx, tenant.id, ctx.serie, numeroInicial);
    const chave = buildChaveNFe({
      uf: tenant.uf,
      cnpj: tenant.cnpj,
      serie: ctx.serie,
      numero,
    });

    const aliqFallback = resolveIcmsFallbackRate(tenant.uf, destUf, "inbound", emitterSettings);
    const cfop = resolveRetornoSimbolicoCfop(tenant.uf, destUf);
    const calc = calculateInboundInvoice(
      orderLineFromProduct(product, {
        cfop,
        quantidade,
        valorUnitario: unitCusto,
      }),
      inboundTaxRule,
      tenant.uf,
      destUf,
      aliqFallback,
      { operationTipo: "RETORNO_SIMBOLICO", emitterSettings },
    );

    const autXmlCpfs = emitterSettings.nfe.autXmlCpfs?.filter(
      (c) => c.replace(/\D/g, "").length === 11,
    );
    const fiscalPayload = enrichFiscalPayloadMlFulfillment(
      enrichFiscalPayloadWithXTexto(
        {
          ...enrichTaxSnapshot(taxSnapshotFromRule(inboundTaxRule, aliqFallback, emitterSettings), {
            settings: emitterSettings,
            tipo: NFeTipo.RETORNO_SIMBOLICO,
            valor: calc.valor,
            valorIcms: calc.valorIcms,
            emitUf: tenant.uf,
            destUf,
            indFinal: 0,
          }),
          engine: calc.nota,
          ...(destIe ? { destIe } : {}),
          ...(product.exTipi ? { exTipi: product.exTipi } : {}),
        } as Record<string, unknown>,
        {
          tipo: NFeTipo.RETORNO_SIMBOLICO,
          cfop,
          natOp: RETORNO_SIMBOLICO_NAT_OP,
          pedidoMl: ctx.pedidoMl,
        },
      ),
      {
        quantidadeTotal: quantidade,
        withLogistics: false,
        destIe,
        idCadIntTran,
        autXmlCpfs: autXmlCpfs?.length ? autXmlCpfs : null,
      },
    );

    const rascunho = criarRetornoSimbolicoAvanco(
      {
        tenantId: tenant.id,
        productId: product.id,
        serie: ctx.serie,
        quantidade,
        unidadeOrigemId,
        unidadeDestinoId,
      },
      {
        id: remessaPai.id,
        chave: remessaPai.chave,
        tipo: remessaPai.tipo as "REMESSA" | "REMESSA_AVANCO",
      },
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
      destino,
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
    const unidade = await findActiveLogisticsUnitRecord(
      tx as unknown as PrismaClient,
      ctx.tenant.id,
      unidadeDestinoId,
    );
    if (!unidade) {
      throw new RemessaDomainError("CD destino não encontrado ou inativo");
    }

    const destino = unidadeParaDestinoFiscal(unidade);
    const fiscal = await prepareSymbolicShipmentFiscal(tx, {
      tenantId: ctx.tenant.id,
      emitUf: ctx.emitUf,
      destUf: destino.uf,
      product: ctx.product,
      quantidade,
      pedidoMl: ctx.pedidoMl,
      nfeTipo: NFeTipo.REMESSA_AVANCO,
    });

    const emitterSettings = await loadEmitterSettings(tx, ctx.tenant.id);
    const numeroInicial = resolveNumeroInicialNfe(emitterSettings, ctx.serie, {
      serieRemessa: ctx.tenant.serieRemessa,
      serieTransferencia: ctx.tenant.serieTransferencia,
    });
    const numero = await proximoNumeroNfe(tx, ctx.tenant.id, ctx.serie, numeroInicial);
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

    const rascunho = criarRemessaAvanco(
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
