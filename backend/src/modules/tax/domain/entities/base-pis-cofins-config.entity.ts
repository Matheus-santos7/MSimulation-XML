/**
 * Configuração da composição da base de cálculo do PIS/COFINS (por tenant).
 *
 * Cobre os 8 componentes da tela "Config. fiscais" → "Composição da base":
 * - 4 componentes do tipo "incluir / não incluir" (frete, IPI, acréscimo)
 * - 4 componentes do tipo "subtrair / não subtrair" (desconto, ICMS, DIFAL,
 *   FCP do ICMS, FCP do DIFAL).
 *
 * A configuração no domínio é resolvida para um único canal (`VENDA` ou
 * `REMESSA`) ANTES de ser injetada no engine — o engine não precisa saber se a
 * nota é venda ou remessa; recebe só o vetor final aplicável.
 *
 * Não confundir com `ComposicaoTributo` do `fiscal-core`: aquela carrega ambos
 * os canais (venda + remessa) e os 4 estados do enum SEFAZ
 * (`INCLUIR_NA_BASE | NAO_INCLUIR | SUBTRAIR_DA_BASE | NAO_SUBTRAIR`). Esta é a
 * representação interna, normalizada e por canal, consumida pelo `tax-engine`.
 */

/** Componente que só admite `incluir` ou `não incluir` (frete, IPI, acréscimo). */
export type IncludeFlag = "INCLUDE" | "NONE";

/** Componente que só admite `subtrair` ou `não subtrair` (desconto, ICMS, DIFAL, FCP). */
export type DeductFlag = "DEDUCT" | "NONE";

/**
 * Snapshot da composição da base PIS/COFINS resolvida para um canal de operação.
 *
 * Defaults seguros (alinhados ao painel padrão da tela "Config. fiscais"):
 * - `frete`: `INCLUDE` (compõe a receita bruta).
 * - `desconto`: `DEDUCT` (reduz a receita bruta).
 * - `icms` / `difal`: `DEDUCT` (Tese do Século — STF RE 574.706/PR).
 * - `fcpIcms` / `fcpDifal`: `NONE` (não há decisão consolidada de exclusão).
 * - `ipi`: `NONE` (IPI é "por fora"; não compõe receita bruta padrão).
 * - `acrescimo`: `NONE` (acréscimo no preço só compõe se configurado).
 */
export interface BasePisCofinsConfig {
  frete: IncludeFlag;
  desconto: DeductFlag;
  icms: DeductFlag;
  difal: DeductFlag;
  fcpIcms: DeductFlag;
  fcpDifal: DeductFlag;
  ipi: IncludeFlag;
  acrescimo: IncludeFlag;
}

/**
 * Default conservador quando o tenant não tem `fiscal-settings` preenchido OU o
 * caller (testes/legado) não passa `baseConfig`. Reproduz o comportamento legado
 * do engine antes da nova tela: frete na base, desconto subtraído, nada mais.
 *
 * Não inclui exclusão de ICMS/DIFAL — para isso, o tenant deve ter ao menos os
 * defaults do `FiscalEmitterSettings` carregados, que já vêm com `icms`/`difal`
 * em `SUBTRAIR_DA_BASE` (pós-STF).
 */
export const LEGACY_BASE_PIS_COFINS_CONFIG: BasePisCofinsConfig = {
  frete: "INCLUDE",
  desconto: "DEDUCT",
  icms: "NONE",
  difal: "NONE",
  fcpIcms: "NONE",
  fcpDifal: "NONE",
  ipi: "NONE",
  acrescimo: "NONE",
};
