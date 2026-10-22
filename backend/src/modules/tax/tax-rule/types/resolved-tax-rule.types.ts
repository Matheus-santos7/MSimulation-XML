/**
 * Regra fiscal **resolvida** para um par origem×destino e tipo de operação.
 *
 * Produzida por `mapResolvedTaxRule` a partir do `payload` importado (planilha XLSX).
 * Campos `ICMS_{UF}_*` no payload são extraídos usando a UF de **destino** da operação.
 *
 * Usada por `buildFiscalItem` para montar CST, alíquotas, reduções e benefícios.
 *
 * Importante: regras de composição da base PIS/COFINS (Tese do Século — STF RE
 * 574.706/PR — e demais inclusões/deduções) NÃO vivem aqui. Elas são por tenant
 * e ficam em `FiscalEmitterSettings.taxes.composicaoBaseCalculo.pisCofins`. O
 * `buildFiscalItem` resolve a config aplicável (venda × remessa) e injeta no
 * engine via `PisCofinsInput.baseConfig`.
 */
export type ResolvedTaxRule = {
  ruleId: string;
  aliquotaIcmsInterna?: number;
  cfop?: string;
  payload?: Record<string, unknown>;
  icms?: {
    cst?: string;
    pDif?: number;
    pIcmsInternal?: number;
    pIcmsInterstate?: number;
    pRedBc?: number;
    pRedBcSt?: number;
    pRedBcDifal?: number;
    pIcmsFcp?: number;
    pIcmsEfet?: number;
    pRedBcEfet?: number;
    pMva?: number;
    pIcmsStRet?: number;
    pFcpStRet?: number;
    codBenef?: string;
    codBenefRbc?: string;
    codBenefPres?: string;
    pCodBenefPres?: number;
    motDesIcms?: number;
    redAliqIbs?: number;
  };
};
