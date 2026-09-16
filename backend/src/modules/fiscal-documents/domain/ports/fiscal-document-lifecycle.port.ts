import type {
  CancelDocumentResult,
  InutilizationResult,
  ProcessReturnResult,
  ReturnableItemsResult,
} from "../entities/lifecycle-result.entity.js";

export interface CancelDocumentInput {
  tenantId: string;
  nfeKey: string;
  justification?: string;
}

/** Linha da venda a devolver (`nItem` da NF-e de origem) e quantidade. */
export interface ProcessReturnItemInput {
  numeroItem: number;
  quantidade: number;
}

export interface ProcessReturnInput {
  tenantId: string;
  saleNfeKey: string;
  /** Default `DEVOLUCAO`. Use `INSULCESSO_DE_ENTREGA` para insucesso de entrega. */
  returnTipo?: "DEVOLUCAO" | "INSULCESSO_DE_ENTREGA";
  /** Devolução parcial. Omitido/vazio = devolve tudo que ainda resta da venda. */
  itens?: ProcessReturnItemInput[];
}

export interface ReturnableItemsInput {
  tenantId: string;
  saleNfeKey: string;
}

export interface ProcessPhysicalReturnInput {
  tenantId: string;
  remessaNfeKey: string;
}

export interface ProcessPhysicalReturnResult {
  retornoFisico: Record<string, unknown>;
  saldoConsumido: { remessaNfeId: string; quantidade: number };
}

export interface InutilizeNumberInput {
  tenantId: string;
  series: number;
  numberStart: number;
  numberEnd: number;
  justification?: string;
}

export interface DocumentCancellationPort {
  cancelSale(input: CancelDocumentInput): Promise<CancelDocumentResult>;
}

export interface DocumentReturnPort {
  processSaleReturn(input: ProcessReturnInput): Promise<ProcessReturnResult>;
  getReturnableItems(input: ReturnableItemsInput): Promise<ReturnableItemsResult>;
  processPhysicalReturn(input: ProcessPhysicalReturnInput): Promise<ProcessPhysicalReturnResult>;
}

export interface NumberInutilizationPort {
  inutilizeRange(input: InutilizeNumberInput): Promise<InutilizationResult>;
}
