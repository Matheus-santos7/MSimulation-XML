import type {
  InutilizeNumberInput,
  NumberInutilizationPort,
} from "../../domain/ports/fiscal-document-lifecycle.port.js";

/**
 * Inutiliza faixa de numeração NF-e **não utilizada** (`procInutNFe` simulado).
 *
 * Não altera status de documento existente — impede uso futuro de números na série
 * que nunca chegaram a ser emitidos (buracos na sequência).
 *
 * Validações:
 * - Faixa válida (`numeroIni` ≤ `numeroFim`, ambos ≥ 1)
 * - Nenhuma NF-e já emitida nos números da faixa
 * - Sem sobreposição com inutilizações anteriores do tenant/série
 *
 * @param input - `tenantId`, `series`, `numberStart`, `numberEnd`, justificativa opcional
 * @returns Registo `nfe_inutilizacao` com protocolo simulado
 * @throws {NumberInutilizationError} 404 tenant; 409 conflito de faixa; 422 parâmetros inválidos
 */
export class InutilizeNumberUseCase {
  constructor(private readonly inutilization: NumberInutilizationPort) {}

  execute(input: InutilizeNumberInput) {
    return this.inutilization.inutilizeRange(input);
  }
}
