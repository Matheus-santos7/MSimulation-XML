import { OperacaoFiscalTipo } from "../../../../generated/prisma/client.js";
import type { PrismaClient } from "../../../../generated/prisma/client.js";
import type { Product, Tenant } from "../../../../generated/prisma/client.js";
import { gerarPedidoMl } from "../../../../lib/fiscal/nfe-chave.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import { RemessaDomainError, SaldoFifoInsuficienteError } from "../../domain/errors.js";
import type { EstoqueFifoRepository } from "../../domain/ports/estoque-fifo-repository.js";
import type { UnidadeLogisticaPort } from "../../domain/ports/unidade-logistica-port.js";
import type { RemessasAdapters } from "../../infrastructure/factory/remessas-adapters.js";
import { TransferidorSaldoFifo } from "../../domain/services/transferidor-saldo-fifo.js";
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

export type EmitirRemessaFisicaDestino = (input: {
  tenant: Tenant;
  product: Product;
  quantidade: number;
  unidadeDestinoId: string;
  pedidoMl: string;
  observacaoAvanco?: string;
}) => Promise<{ id: string; chave: string }>;

export type EmitirAvancoMercadoriaDeps = {
  prisma: PrismaClient;
  estoqueFifo: EstoqueFifoRepository;
  unidadeLogistica: UnidadeLogisticaPort;
  createAdapters: (db: PrismaClient | PrismaTx) => RemessasAdapters;
  resolverProduto: ResolverProdutoAvanco;
  emitirRemessaFisicaDestino: EmitirRemessaFisicaDestino;
};

/**
 * Caso de uso: Avanço de Mercadoria entre CDs.
 * Cadeia fiscal: [Remessa Inicial] → [Retorno Simbólico] → [Remessa Simbólica]
 */
export class EmitirAvancoMercadoriaUseCase {
  private readonly validador = new ValidadorCadeiaFiscal();
  private readonly transferidor = new TransferidorSaldoFifo();

  constructor(private readonly deps: EmitirAvancoMercadoriaDeps) {}

  async execute(command: EmitirAvancoMercadoriaCommand): Promise<EmitirAvancoMercadoriaResult> {
    this.validarCommand(command);

    if (command.productSku?.trim()) {
      await this.deps.estoqueFifo.realinharProductIdPorSku(
        command.tenantId,
        command.productSku,
      );
    }

    const resolved = await this.deps.resolverProduto(
      command.tenantId,
      command.productId,
      command.productSku,
    );
    if (!resolved) {
      throw new RemessaDomainError("Produto não encontrado para avanço de mercadoria");
    }

    const [origem, destino] = await Promise.all([
      this.deps.unidadeLogistica.obterAtiva(command.tenantId, command.unidadeOrigemId),
      this.deps.unidadeLogistica.obterAtiva(command.tenantId, command.unidadeDestinoId),
    ]);
    if (!origem || !destino) {
      throw new RemessaDomainError("CD de origem ou destino inválido");
    }

    const linhas = await this.deps.estoqueFifo.listarLinhasComSaldo({
      tenantId: command.tenantId,
      productId: resolved.fifoProductId,
      productSku: command.productSku,
      unidadeDestinoId: command.unidadeOrigemId,
    });

    let debito;
    try {
      debito = this.transferidor.debitar(linhas, command.quantidade, command.unidadeOrigemId);
    } catch (e) {
      if (e instanceof SaldoFifoInsuficienteError) {
        throw new RemessaDomainError(
          `Saldo insuficiente no CD ${origem.codigo}. Disponível: ${e.disponivel}, solicitado: ${e.solicitado}.`,
        );
      }
      throw e;
    }

    const tenant = await this.deps.prisma.tenant.findUniqueOrThrow({
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

    const resultado = await this.deps.prisma.$transaction(async (tx) => {
      const { estoqueFifo, notaFiscal, emissorNota } = this.deps.createAdapters(tx);

      const remessaPrincipal = await notaFiscal.buscarRemessaPrincipal(debito.alocacoes);
      if (!remessaPrincipal || remessaPrincipal.tipo !== "REMESSA") {
        throw new RemessaDomainError("Remessa inicial de referência não encontrada para o avanço");
      }

      await estoqueFifo.aplicarDebito(command.tenantId, debito.alocacoes);

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
        debito.alocacoes,
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

      return { remessaPrincipal, retornoPersistido, remessaSimbPersistida };
    });

    const remessaDestino = await this.deps.emitirRemessaFisicaDestino({
      tenant,
      product: resolved.product,
      quantidade: command.quantidade,
      unidadeDestinoId: destino.id,
      pedidoMl,
      observacaoAvanco: `Avanço ${origem.codigo} → ${destino.codigo}`,
    });

    await this.deps.prisma.$transaction(async (tx) => {
      await this.deps.createAdapters(tx).movimentacao.registrar({
        tenantId: command.tenantId,
        productId: resolved.product.id,
        tipoOperacao: OperacaoFiscalTipo.AVANCO_CD,
        quantidade: command.quantidade,
        unidadeOrigemId: origem.id,
        unidadeDestinoId: destino.id,
        nfeId: resultado.remessaSimbPersistida.id,
        nfeSecundariaId: remessaDestino.id,
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
      remessaDestino,
      alocacoesFifo: debito.alocacoes.map((a) => ({
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
