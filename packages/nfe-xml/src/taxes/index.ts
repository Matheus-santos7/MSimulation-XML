/**
 * Camada canônica Sprint 2 — resolvers fiscais orientados a objetos AST.
 *
 * @module taxes
 */

export {
  resolveIcmsFromSnapshot,
  resolveIcmsFromEngine,
  type IcmsSnapshotContext,
} from "./icms.resolver.js";
export { resolveIpiInt, resolveIpiFromEngine, resolveIpiFromSnapshot } from "./ipi.resolver.js";
export { resolvePisCofinsFromEngine } from "./pis-cofins.resolver.js";
export {
  resolveIbsCbsImposto,
  resolveIbsCbsImpostoVenda,
  resolveIbsCbsImpostoRemessa,
  type IbsCbsImpostoInput,
} from "./ibscbs.resolver.js";
export {
  roundMoney,
  formatMoney2,
  formatMoney4,
  cst2Digits,
  asNumeric,
} from "./tax-format.util.js";
