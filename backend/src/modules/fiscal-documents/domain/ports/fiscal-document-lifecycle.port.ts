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
}

export interface NumberInutilizationPort {
  inutilizeRange(input: InutilizeNumberInput): Promise<InutilizationResult>;
}
