import type {
  NFeDto,
  CTeDto,
} from "../fiscal-types";
import { buildApiUrl, mutateJson } from "./client";
import type { RemessaManualItemInput } from "./logistics";

export type TransferenciaFilialResult = {
  transferencia: NFeDto;
  remessa: NFeDto;
  cte: CTeDto;
  totalItens: number;
  filial: { id: string; cnpj: string; uf: string; serieRemessa: number };
  unidadeDestinoId: string;
};

export async function emitBranchTransfer(body: {
  filialId: string;
  items: RemessaManualItemInput[];
}): Promise<TransferenciaFilialResult> {
  return mutateJson<TransferenciaFilialResult>(
    buildApiUrl("/api/movimentacoes/transferencia-filial"),
    "POST",
    body,
  ) as Promise<TransferenciaFilialResult>;
}

export async function realignRemessaFifo(productSku: string): Promise<{
  atualizados: number;
  productId: string | null;
}> {
  return mutateJson<{ atualizados: number; productId: string | null }>(
    buildApiUrl("/api/movimentacoes/remessa/realign-fifo"),
    "POST",
    { productSku },
  ) as Promise<{ atualizados: number; productId: string | null }>;
}
