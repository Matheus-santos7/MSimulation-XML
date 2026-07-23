import type {
  CancelDocumentResult,
  InutilizationResult,
  ProcessReturnResult,
} from "../entities/lifecycle-result.entity.js";

export interface CancelDocumentInput {
  tenantId: string;
  nfeKey: string;
  justification?: string;
}

export interface ProcessReturnInput {
  tenantId: string;
  saleNfeKey: string;
  /** Default `DEVOLUCAO`. Use `INSULCESSO_DE_ENTREGA` para insucesso de entrega. */
  returnTipo?: "DEVOLUCAO" | "INSULCESSO_DE_ENTREGA";
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
  processPhysicalReturn(input: ProcessPhysicalReturnInput): Promise<ProcessPhysicalReturnResult>;
}

export interface NumberInutilizationPort {
  inutilizeRange(input: InutilizeNumberInput): Promise<InutilizationResult>;
}
