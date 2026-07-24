import { NFeTipo, type NFeTipoValue } from "./nfe-tipo.js";

/**
 * CST PIS/COFINS no retorno simbólico ML Full — grupo `<PISOutr>`/`<COFINSOutr>` (MOC 7.0).
 * A planilha inbound costuma trazer CST 09 (suspensão) para remessa; no retorno simbólico o ML emite 98.
 */
export const PIS_COFINS_CST_SYMBOLIC_RETURN = "98";

/**
 * CST IPI de entrada com suspensão (par de saída 55).
 * Mantido como constante histórica do retorno simbólico ML Full.
 * @see mapIpiSaidaToEntrada
 */
export const IPI_CST_SYMBOLIC_RETURN = "05";

/**
 * De/para IPI saída → entrada (doc ML: templates IPI agrupam pares
 * 00/50, 01/51, 02/52, 03/53, 04/54, 05/55, 49/99).
 * https://developers.mercadolivre.com.br/pt_br/configuracoes-de-composicao-de-base-de-calculo-do-icms-e-ipi
 */
const IPI_SAIDA_PARA_ENTRADA: Readonly<Record<string, string>> = {
  "50": "00",
  "51": "01",
  "52": "02",
  "53": "03",
  "54": "04",
  "55": "05",
  "99": "49",
};

const IPI_OPERACOES_ENTRADA = new Set<string>([
  NFeTipo.RETORNO_SIMBOLICO,
  NFeTipo.RETORNO_FISICO,
  NFeTipo.DEVOLUCAO,
  NFeTipo.INSULCESSO_DE_ENTREGA,
]);

const ML_DEFAULT_MOD_FRETE: Record<NFeTipoValue, string> = {
  VENDA: "9",
  REMESSA: "0",
  RETORNO_SIMBOLICO: "9",
  RETORNO_FISICO: "9",
  REMESSA_SIMBOLICA: "2",
  REMESSA_AVANCO: "2",
  DEVOLUCAO: "9",
  INSULCESSO_DE_ENTREGA: "9",
  TRANSFERENCIA_FILIAL: "2",
};

function pickTaxStCode(snapshotSt: string): string {
  return String(snapshotSt).trim().slice(0, 2);
}

/**
 * Converte CST IPI de saída (50–55, 99) para o equivalente de entrada (00–05, 49).
 * CST já de entrada (ou fora da tabela) permanece inalterado.
 */
export function mapIpiSaidaToEntrada(cstOrLabel: string): string {
  const cst = pickTaxStCode(cstOrLabel);
  return IPI_SAIDA_PARA_ENTRADA[cst] ?? cst;
}

/** Resolve CST PIS/COFINS (2 dígitos) conforme o tipo de operação fiscal. */
export function resolvePisCofinsCstFromSnapshot(
  snapshotSt: string,
  operationTipo?: NFeTipoValue | string,
): string {
  if (operationTipo === NFeTipo.RETORNO_SIMBOLICO || operationTipo === NFeTipo.RETORNO_FISICO) {
    return PIS_COFINS_CST_SYMBOLIC_RETURN;
  }
  return pickTaxStCode(snapshotSt);
}

/**
 * Resolve CST IPI (2 dígitos) conforme o tipo de operação fiscal.
 * Em notas de entrada (retorno / devolução / insucesso), aplica de/para saída→entrada.
 */
export function resolveIpiCstFromSnapshot(
  snapshotSt: string,
  operationTipo?: NFeTipoValue | string,
): string {
  const raw = pickTaxStCode(snapshotSt);
  if (operationTipo != null && IPI_OPERACOES_ENTRADA.has(String(operationTipo))) {
    return mapIpiSaidaToEntrada(raw);
  }
  return raw;
}

/** Modalidade de frete padrão ML quando settings estão em modo DEFAULT. */
export function resolveDefaultModFreteForTipo(tipo: NFeTipoValue): string {
  return ML_DEFAULT_MOD_FRETE[tipo] ?? "0";
}
