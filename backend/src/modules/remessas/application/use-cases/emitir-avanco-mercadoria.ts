import { OperacaoFiscalTipo } from "../../../../generated/prisma/client.js";
import type { PrismaClient } from "../../../../generated/prisma/client.js";
import type { Product, Tenant } from "../../../../generated/prisma/client.js";
import { gerarPedidoMl } from "../../../../lib/fiscal/nfe-chave.js";
import { FISCAL_TRANSACTION_OPTIONS, type PrismaTx } from "../../../../lib/db/prisma-tx.js";
import { emitirCteRemessa } from "../../../../services/fiscal/remessa/cte-remessa-service.js";
import {
  debitarSaldoRemessaPorCd,
  resolveOrigemFiscalParaAvanco,
  saldoRemessaDisponivel,
  SaldoRemessaInsuficienteError,
} from "../../../../services/fiscal/remessa/remessa-fifo.js";
import {
  getUnidadeAtivaDoTenant,
  getUnidadeAtivaPorCodigo,
} from "../../../../services/logistics/unidade-logistica-service.js";
import { quantidadeSaldo } from "../../domain/value-objects/quantidade-saldo.js";
import { RemessaDomainError } from "../../domain/errors.js";
import type { EstoqueFifoRepository } from "../../domain/ports/estoque-fifo-repository.js";
import type { UnidadeLogisticaPort } from "../../domain/ports/unidade-logistica-port.js";
import type { RemessasAdapters } from "../../infrastructure/factory/remessas-adapters.js";
import { ValidadorCadeiaFiscal } from "../../domain/services/validador-cadeia-fiscal.js";
import type {
  EmitirAvancoMercadoriaCommand,
  EmitirAvancoMercadoriaResult,
} from "../dto/emitir-avanco-mercadoria.command.js";

export type ResolverProdutoAvanco = (
  tenantId: string,
  productId: string,
  productSku?: string,
) => Promise<{ product: Product; fifoProductId: string } | null>;

export type EmitirAvancoMercadoriaDeps = {
  prisma: PrismaClient;
  estoqueFifo: EstoqueFifoRepository;
  unidadeLogistica: UnidadeLogisticaPort;
  createAdapters: (db: PrismaClient | PrismaTx) => RemessasAdapters;
  resolverProduto: ResolverProdutoAvanco;
};

function mapUnidade(row: { id: string; codigo: string; uf: string; nome: string }) {
  return { id: row.id, codigo: row.codigo, uf: row.uf, nome: row.nome };
}

/**
 * Caso de uso: Avanço de Mercadoria entre CDs.
 * Cadeia fiscal: [Remessa Inicial] → [Retorno Simbólico] → [Remessa Simbólica].
 * O saldo fica na remessa simbólica no CD destino (sem remessa física adicional).
 */
export class EmitirAvancoMercadoriaUseCase {
  private readonly validador = new ValidadorCadeiaFiscal();

  constructor(private readonly deps: EmitirAvancoMercadoriaDeps) {}

  async execute(command: EmitirAvancoMercadoriaCommand): Promise<EmitirAvancoMercadoriaResult> {
    this.validarCommand(command);

    const resolved = await this.deps.resolverProduto(
      command.tenantId,
      command.productId,
      command.productSku,
    );
    if (!resolved) {
      throw new RemessaDomainError("Produto não encontrado para avanço de mercadoria");
    }

    const productSku = command.productSku?.trim() || resolved.product.sku;
    if (productSku) {
      await this.deps.estoqueFifo.realinharProductIdPorSku(command.tenantId, productSku);
    }

    // Mesmo critério de GET /movimentacoes/saldo-cd (productId do formulário + SKU).
    const saldoProductId = command.productId.trim() || resolved.product.id;

    const prisma = this.deps.prisma;
    const origemResolvida = await resolveOrigemFiscalParaAvanco(
      prisma,
      command.tenantId,
      saldoProductId,
      command.unidadeOrigemId,
      productSku,
      async (id) => {
        const row = await getUnidadeAtivaDoTenant(prisma, command.tenantId, id);
        return row ? mapUnidade(row) : null;
      },
      async (codigo) => {
        const row = await getUnidadeAtivaPorCodigo(prisma, codigo);
        return row ? mapUnidade(row) : null;
      },
    );

    if (!origemResolvida) {
      throw new RemessaDomainError(
        "CD de origem não encontrado ou inativo. Reimporte as unidades ML ou emita nova remessa física no CD.",
      );
    }

    const { origem, fifoOrigemId } = origemResolvida;

    const destino = await this.deps.unidadeLogistica.obterAtiva(
      command.tenantId,
      command.unidadeDestinoId,
    );
    if (!destino) {
      throw new RemessaDomainError("CD de destino não encontrado ou inativo");
    }

    const saldoDisponivel = await saldoRemessaDisponivel(
      prisma,
      command.tenantId,
      saldoProductId,
      fifoOrigemId,
      productSku,
    );

    if (saldoDisponivel < command.quantidade) {
      throw new RemessaDomainError(
        `Saldo insuficiente no CD ${origem.codigo}. Disponível: ${saldoDisponivel}, solicitado: ${command.quantidade}.`,
      );
    }

    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: command.tenantId },
    });

    const pedidoMl = gerarPedidoMl();
    const ctx = {
      tenant,
      product: resolved.product,
      emitUf: tenant.uf,
      destUf: origem.uf,
      pedidoMl,
      serie: tenant.serieRemessa,
    };

    const resultado = await prisma.$transaction(async (tx) => {
      const { estoqueFifo, notaFiscal, emissorNota } = this.deps.createAdapters(tx);

      let alocacoesRaw;
      try {
        alocacoesRaw = await debitarSaldoRemessaPorCd(
          tx,
          command.tenantId,
          saldoProductId,
          command.quantidade,
          fifoOrigemId,
          productSku,
        );
      } catch (e) {
        if (e instanceof SaldoRemessaInsuficienteError) {
          throw new RemessaDomainError(
            `Saldo insuficiente no CD ${origem.codigo}. Disponível: ${e.disponivel}, solicitado: ${e.solicitado}.`,
          );
        }
        throw e;
      }

      const alocacoes = alocacoesRaw.map((a) => ({
        remessaNfeId: a.remessaNfeId,
        nfeItemId: a.nfeItemId,
        quantidade: quantidadeSaldo(a.quantidade),
      }));

      const remessaPrincipal = await notaFiscal.buscarRemessaPrincipal(alocacoes);
      if (
        !remessaPrincipal ||
        (remessaPrincipal.tipo !== "REMESSA" && remessaPrincipal.tipo !== "REMESSA_SIMBOLICA")
      ) {
        throw new RemessaDomainError("Remessa de referência não encontrada para o avanço");
      }

      const docRetorno = await emissorNota.prepararRetornoSimbolicoAvanco(
        tx,
        ctx,
        command.quantidade,
        { id: remessaPrincipal.id, chave: remessaPrincipal.chave },
        origem.id,
      );
      this.validador.validarRascunho(docRetorno.rascunho);

      const retornoPersistido = await notaFiscal.persistir({
        ...docRetorno.rascunho,
        numero: docRetorno.numero,
        chave: docRetorno.chave,
        fiscalPayload: docRetorno.fiscalPayload,
        valor: docRetorno.valor,
        valorIcms: docRetorno.valorIcms,
        aliqIcms: docRetorno.aliqIcms,
        natOp: docRetorno.natOp,
        cfop: docRetorno.cfop,
        ncm: resolved.product.ncm,
        pedidoMl,
        destino: docRetorno.destino,
      });

      await estoqueFifo.registrarConsumoRemessa(
        command.tenantId,
        retornoPersistido.id,
        alocacoes,
      );

      await notaFiscal.persistirXmlFromEmission({
        nfeId: retornoPersistido.id,
        tenant,
        productId: resolved.product.id,
        nfeReferenciaChave: remessaPrincipal.chave,
      });

      const docRemessaSimb = await emissorNota.prepararRemessaSimbolicaAvanco(
        tx,
        { ...ctx, destUf: destino.uf },
        command.quantidade,
        { id: retornoPersistido.id, chave: retornoPersistido.chave },
        origem.id,
        destino.id,
      );
      this.validador.validarRascunho(docRemessaSimb.rascunho);
      this.validador.validarSequenciaAvanco(
        remessaPrincipal.id,
        retornoPersistido,
        docRemessaSimb.rascunho,
      );

      const remessaSimbPersistida = await notaFiscal.persistir({
        ...docRemessaSimb.rascunho,
        numero: docRemessaSimb.numero,
        chave: docRemessaSimb.chave,
        fiscalPayload: docRemessaSimb.fiscalPayload,
        valor: docRemessaSimb.valor,
        valorIcms: docRemessaSimb.valorIcms,
        aliqIcms: docRemessaSimb.aliqIcms,
        natOp: docRemessaSimb.natOp,
        cfop: docRemessaSimb.cfop,
        ncm: resolved.product.ncm,
        pedidoMl,
        destino: docRemessaSimb.destino,
      });

      await notaFiscal.persistirXmlFromEmission({
        nfeId: remessaSimbPersistida.id,
        tenant,
        productId: resolved.product.id,
        nfeReferenciaChave: retornoPersistido.chave,
      });

      await tx.nfeItem.create({
        data: {
          tenantId: command.tenantId,
          nfeId: remessaSimbPersistida.id,
          productId: saldoProductId,
          numeroItem: 1,
          quantidade: command.quantidade,
          valor: docRemessaSimb.valor,
          valorIcms: docRemessaSimb.valorIcms,
          ncm: resolved.product.ncm,
          cfop: docRemessaSimb.cfop,
          saldoDisponivel: command.quantidade,
        },
      });

      const remessaSimbNfe = await tx.nFe.findUniqueOrThrow({
        where: { id: remessaSimbPersistida.id },
      });
      const cte = await emitirCteRemessa(tx, tenant, remessaSimbNfe);

      return {
        remessaPrincipal,
        retornoPersistido,
        remessaSimbPersistida,
        alocacoes,
        cte,
      };
    }, FISCAL_TRANSACTION_OPTIONS);

    await prisma.$transaction(async (tx) => {
      await this.deps.createAdapters(tx).movimentacao.registrar({
        tenantId: command.tenantId,
        productId: resolved.product.id,
        tipoOperacao: OperacaoFiscalTipo.AVANCO_CD,
        quantidade: command.quantidade,
        unidadeOrigemId: origem.id,
        unidadeDestinoId: destino.id,
        nfeId: resultado.remessaSimbPersistida.id,
        observacao: `Avanço ${origem.codigo} → ${destino.codigo}`,
      });
    });

    return {
      remessaReferenciaId: resultado.remessaPrincipal.id,
      retornoSimbolico: {
        id: resultado.retornoPersistido.id,
        chave: resultado.retornoPersistido.chave,
      },
      remessaSimbolica: {
        id: resultado.remessaSimbPersistida.id,
        chave: resultado.remessaSimbPersistida.chave,
      },
      cte: resultado.cte,
      alocacoesFifo: resultado.alocacoes.map((a) => ({
        remessaNfeId: a.remessaNfeId,
        nfeItemId: a.nfeItemId,
        quantidade: a.quantidade,
      })),
    };
  }

  private validarCommand(command: EmitirAvancoMercadoriaCommand): void {
    if (command.quantidade < 1) {
      throw new RemessaDomainError("Quantidade deve ser pelo menos 1");
    }
    if (command.unidadeOrigemId === command.unidadeDestinoId) {
      throw new RemessaDomainError("CD de origem e destino devem ser diferentes");
    }
  }
}
