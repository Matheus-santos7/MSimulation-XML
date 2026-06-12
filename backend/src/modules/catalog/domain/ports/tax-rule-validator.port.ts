/**
 * Port para validar vínculo produto ↔ regra fiscal antes de persistir.
 *
 * Delega ao módulo **tax** a verificação de que `taxRuleBaseId` existe,
 * pertence ao tenant e é aplicável à UF do emitente.
 */
export interface TaxRuleValidatorPort {
  /**
   * Garante que a regra fiscal pode ser associada ao produto.
   *
   * @param tenantId - Tenant emitente
   * @param taxRuleBaseId - ID da regra base (tax module)
   * @param tenantUf - UF do tenant para validação regional
   * @throws {TaxRuleCatalogError} Regra inexistente ou incompatível
   */
  assertProductTaxRuleBaseId(
    tenantId: string,
    taxRuleBaseId: string,
    tenantUf: string,
  ): Promise<void>;
}
