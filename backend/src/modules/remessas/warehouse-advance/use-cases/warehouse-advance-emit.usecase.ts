import { Inject, Injectable } from "@nestjs/common";
import { OperacaoFiscalTipo, type Product } from "../../../../generated/prisma/client.js";
import { runFiscalTransaction, type PrismaTx } from "../../../../lib/db/prisma-tx.js";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import { gerarPedidoMl } from "../../../fiscal-documents/index.js";
import { LogisticsUnitService, ProductMovementService } from "../../../logistics/index.js";
import { RemessaDomainError } from "../../errors/remessas.errors.js";
import { FiscalChainNoteRepository } from "../../fiscal-chain/fiscal-chain-note.repository.js";
import type { NotaFiscal } from "../../fiscal-chain/fiscal-chain.types.js";
import { ValidadorCadeiaFiscal } from "../../fiscal-chain/rules/validador-cadeia-fiscal.js";
import { emitShipmentCte } from "../../fiscal-chain/shipment-cte.js";
import {
  debitRemessaBalanceByCd,
  getAvailableRemessaBalance,
  resolveAdvanceFiscalOrigin,
  SaldoRemessaInsuficienteError,
} from "../../stock-fifo/remessa-fifo.js";
import { quantidadeSaldo } from "../../stock-fifo/rules/quantidade-saldo.js";
import { StockFifoRepository } from "../../stock-fifo/stock-fifo.repository.js";
import type { AlocacaoFifo } from "../../stock-fifo/stock-fifo.types.js";
import type { ContextoFiscalEmissao } from "../types/warehouse-advance-fiscal.types.js";
import { WarehouseAdvanceFiscalEmitter } from "../warehouse-advance-fiscal.emitter.js";
import type {
  WarehouseAdvanceCommand,
  WarehouseAdvanceResult,
} from "../warehouse-advance.types.js";

type ActiveUnit = NonNullable<Awaited<ReturnType<LogisticsUnitService["getActive"]>>>;

function saldoInsuficiente(codigo: string, disponivel: number, solicitado: number) {
  return new RemessaDomainError(
    `Saldo insuficiente no CD ${codigo}. Disponível: ${disponivel}, solicitado: ${solicitado}.`,
  );
}

/**
 * Avanço de mercadoria entre CDs do mesmo marketplace.
 * Cadeia fiscal: [Remessa] → [Retorno Simbólico] → [Remessa Avanço]. O saldo passa para a
 * remessa de avanço no CD destino, sem nova remessa física.
 */
@Injectable()
export class WarehouseAdvanceEmitUseCase {
  private readonly validador = new ValidadorCadeiaFiscal();

  constructor(
    @Inject(LogisticsUnitService) private readonly units: LogisticsUnitService,
    @Inject(ProductMovementService) private readonly movements: ProductMovementService,
    @Inject(StockFifoRepository) private readonly stockFifo: StockFifoRepository,
    @Inject(FiscalChainNoteRepository) private readonly notes: FiscalChainNoteRepository,
    @Inject(WarehouseAdvanceFiscalEmitter)
    private readonly fiscalEmitter: WarehouseAdvanceFiscalEmitter,
  ) {}

  async execute(command: WarehouseAdvanceCommand): Promise<WarehouseAdvanceResult> {
    this.validateCommand(command);

    const product = await this.resolveProduct(command);
    const productSku = command.productSku?.trim() || product.sku;
    if (productSku) {
      await this.stockFifo.realignProductIdBySku(command.tenantId, productSku);
    }

    // Mesmo critério de GET /movimentacoes/saldo-cd (productId do formulário + SKU).
    const saldoProductId = command.productId.trim() || product.id;
    const prisma = getDbClient();
    const origemResolvida = await resolveAdvanceFiscalOrigin<ActiveUnit>(
      prisma,
      command.tenantId,
      saldoProductId,
      command.unidadeOrigemId,
      productSku,
      (id) => this.units.getActive(id),
      (codigo) => this.units.getActiveByCode(codigo),
    );
    if (!origemResolvida) {
      throw new RemessaDomainError(
        "CD de origem não encontrado ou inativo. Reimporte as unidades do marketplace ou emita nova remessa física no CD.",
      );
    }

    const { origem, fifoOrigemId } = origemResolvida;
    const destino = await this.units.getActive(command.unidadeDestinoId);
    if (!destino) {
      throw new RemessaDomainError("CD de destino não encontrado ou inativo");
    }
    if (origem.marketplace !== destino.marketplace) {
      throw new RemessaDomainError("O avanço só pode ocorrer entre CDs do mesmo marketplace");
    }

    const saldoDisponivel = await getAvailableRemessaBalance(
      prisma,
      command.tenantId,
      saldoProductId,
      fifoOrigemId,
      productSku,
    );
    if (saldoDisponivel < command.quantidade) {
      throw saldoInsuficiente(origem.codigo, saldoDisponivel, command.quantidade);
    }

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: command.tenantId } });
    const pedidoMl = gerarPedidoMl();
    const ctx: ContextoFiscalEmissao = {
      tenant,
      marketplace: destino.marketplace,
      product,
      emitUf: tenant.uf,
      destUf: destino.uf,
      pedidoMl,
      serie: tenant.serieRemessa,
    };

    const resultado = await runFiscalTransaction(prisma, command.tenantId, async (tx) => {
      const alocacoes = await this.debitOrigin(tx, command, {
        saldoProductId,
        fifoOrigemId,
        productSku,
        origemCodigo: origem.codigo,
      });
      const remessaPrincipal = await this.notes.findMainShipment(alocacoes);
      if (
        !remessaPrincipal ||
        (remessaPrincipal.tipo !== "REMESSA" && remessaPrincipal.tipo !== "REMESSA_AVANCO")
      ) {
        throw new RemessaDomainError("Remessa de referência não encontrada para o avanço");
      }

      const retornoPersistido = await this.emitReturn(tx, ctx, command, {
        remessaPrincipal,
        alocacoes,
        origemId: origem.id,
        destinoId: destino.id,
      });
      const remessaSimbPersistida = await this.emitAdvanceShipment(tx, ctx, command, {
        remessaPrincipalId: remessaPrincipal.id,
        retornoPersistido,
        saldoProductId,
        origemId: origem.id,
        destinoId: destino.id,
      });

      const remessaSimbNfe = await tx.nFe.findUniqueOrThrow({
        where: { id: remessaSimbPersistida.id },
      });
      const cte = await emitShipmentCte(tx, tenant, remessaSimbNfe);

      return { remessaPrincipal, retornoPersistido, remessaSimbPersistida, alocacoes, cte };
    });

    // Fora da transação fiscal: falha no histórico não desfaz a emissão.
    await runFiscalTransaction(prisma, command.tenantId, async (tx) => {
      await this.movements.register(
        {
          tenantId: command.tenantId,
          productId: product.id,
          tipoOperacao: OperacaoFiscalTipo.AVANCO_CD,
          quantidade: command.quantidade,
          unidadeOrigemId: origem.id,
          unidadeDestinoId: destino.id,
          nfeId: resultado.remessaSimbPersistida.id,
          observacao: `Avanço ${origem.codigo} → ${destino.codigo}`,
        },
        tx,
      );
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

  private validateCommand(command: WarehouseAdvanceCommand): void {
    if (command.quantidade < 1) {
      throw new RemessaDomainError("Quantidade deve ser pelo menos 1");
    }
    if (command.unidadeOrigemId === command.unidadeDestinoId) {
      throw new RemessaDomainError("CD de origem e destino devem ser diferentes");
    }
  }

  /** O avanço exige o produto no cadastro; a mensagem diferencia "tem saldo" de "não existe". */
  private async resolveProduct(command: WarehouseAdvanceCommand): Promise<Product> {
    const resolved = await this.movements.resolveAdvanceProduct(
      command.tenantId,
      command.productId,
      command.productSku,
    );
    if (!resolved) {
      throw new RemessaDomainError(await this.productNotRegisteredMessage(command));
    }

    const product = await getDbClient().product.findFirst({
      where: { id: resolved.productId, tenantId: command.tenantId },
    });
    if (!product) {
      throw new RemessaDomainError("Produto não encontrado para avanço de mercadoria");
    }

    return product;
  }

  private async productNotRegisteredMessage(command: WarehouseAdvanceCommand): Promise<string> {
    const hasStock = await this.movements.hasAdvanceStock(
      command.tenantId,
      command.productId,
      command.productSku,
    );
    const skuHint = command.productSku?.trim() ? ` (SKU ${command.productSku.trim()})` : "";

    return hasStock
      ? `Há saldo FIFO${skuHint}, mas o produto não está no cadastro desta empresa. Abra Produtos e confira se o SKU está cadastrado com regra fiscal e preço de custo.`
      : `Produto não encontrado nesta empresa${skuHint}. Cadastre em Produtos ou emita nova remessa física para o CD de origem.`;
  }

  private async debitOrigin(
    tx: PrismaTx,
    command: WarehouseAdvanceCommand,
    origin: {
      saldoProductId: string;
      fifoOrigemId: string;
      productSku?: string;
      origemCodigo: string;
    },
  ): Promise<AlocacaoFifo[]> {
    try {
      const alocacoes = await debitRemessaBalanceByCd(
        tx,
        command.tenantId,
        origin.saldoProductId,
        command.quantidade,
        origin.fifoOrigemId,
        origin.productSku,
      );

      return alocacoes.map((a) => ({
        remessaNfeId: a.remessaNfeId,
        nfeItemId: a.nfeItemId,
        quantidade: quantidadeSaldo(a.quantidade),
      }));
    } catch (e) {
      if (e instanceof SaldoRemessaInsuficienteError) {
        throw saldoInsuficiente(origin.origemCodigo, e.disponivel, e.solicitado);
      }
      throw e;
    }
  }

  /** Retorno simbólico do CD origem ao seller, referenciando a remessa debitada. */
  private async emitReturn(
    tx: PrismaTx,
    ctx: ContextoFiscalEmissao,
    command: WarehouseAdvanceCommand,
    refs: {
      remessaPrincipal: NotaFiscal;
      alocacoes: AlocacaoFifo[];
      origemId: string;
      destinoId: string;
    },
  ): Promise<NotaFiscal> {
    const doc = await this.fiscalEmitter.prepararRetornoSimbolicoAvanco(
      tx,
      ctx,
      command.quantidade,
      { id: refs.remessaPrincipal.id, chave: refs.remessaPrincipal.chave },
      refs.origemId,
      refs.destinoId,
    );
    this.validador.validarRascunho(doc.rascunho);

    const persisted = await this.notes.persist({
      ...doc.rascunho,
      marketplace: ctx.marketplace,
      numero: doc.numero,
      chave: doc.chave,
      fiscalPayload: doc.fiscalPayload,
      valor: doc.valor,
      valorIcms: doc.valorIcms,
      aliqIcms: doc.aliqIcms,
      natOp: doc.natOp,
      cfop: doc.cfop,
      ncm: ctx.product.ncm,
      pedidoMl: ctx.pedidoMl,
      destino: doc.destino,
    });
    await this.stockFifo.registerConsumption(persisted.id, refs.alocacoes);
    await this.notes.persistXmlFromEmission({
      nfeId: persisted.id,
      tenant: ctx.tenant,
      productId: ctx.product.id,
      marketplace: ctx.marketplace,
      nfeReferenciaChave: refs.remessaPrincipal.chave,
    });

    return persisted;
  }

  /** Remessa de avanço ao CD destino; cria o novo saldo FIFO lá. */
  private async emitAdvanceShipment(
    tx: PrismaTx,
    ctx: ContextoFiscalEmissao,
    command: WarehouseAdvanceCommand,
    refs: {
      remessaPrincipalId: string;
      retornoPersistido: NotaFiscal;
      saldoProductId: string;
      origemId: string;
      destinoId: string;
    },
  ): Promise<NotaFiscal> {
    const doc = await this.fiscalEmitter.prepararRemessaSimbolicaAvanco(
      tx,
      ctx,
      command.quantidade,
      { id: refs.retornoPersistido.id, chave: refs.retornoPersistido.chave },
      refs.origemId,
      refs.destinoId,
    );
    this.validador.validarRascunho(doc.rascunho);
    this.validador.validarSequenciaAvanco(
      refs.remessaPrincipalId,
      refs.retornoPersistido,
      doc.rascunho,
    );

    const persisted = await this.notes.persist({
      ...doc.rascunho,
      marketplace: ctx.marketplace,
      numero: doc.numero,
      chave: doc.chave,
      fiscalPayload: doc.fiscalPayload,
      valor: doc.valor,
      valorIcms: doc.valorIcms,
      aliqIcms: doc.aliqIcms,
      natOp: doc.natOp,
      cfop: doc.cfop,
      ncm: ctx.product.ncm,
      pedidoMl: ctx.pedidoMl,
      destino: doc.destino,
    });
    await this.notes.persistXmlFromEmission({
      nfeId: persisted.id,
      tenant: ctx.tenant,
      productId: ctx.product.id,
      marketplace: ctx.marketplace,
      nfeReferenciaChave: refs.retornoPersistido.chave,
    });

    await tx.nfeItem.create({
      data: {
        tenantId: command.tenantId,
        nfeId: persisted.id,
        productId: refs.saldoProductId,
        numeroItem: 1,
        quantidade: command.quantidade,
        valor: doc.valor,
        valorIcms: doc.valorIcms,
        ncm: ctx.product.ncm,
        cfop: doc.cfop,
        saldoDisponivel: command.quantidade,
      },
    });

    return persisted;
  }
}
