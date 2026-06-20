/**
 * BARREL DE TRANSIÇÃO PT → EN
 *
 * Este ficheiro mantém os nomes PT para compatibilidade com código existente.
 * A implementação real está em `branch-transfer/`.
 *
 * TODO: Migrar os importadores para `branch-transfer/index.js` e remover este ficheiro.
 */
export {
  emitBranchTransfer as emitirTransferenciaFilial,
  BranchTransferError as TransferenciaFilialError,
  type BranchTransferItemInput as TransferenciaFilialItemInput,
  ShipmentError as RemessaError,
} from "./branch-transfer/index.js";

export { EmitenteFiscalConfigError } from "../../../org/index.js";
