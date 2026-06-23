/**
 * Resolve a composição da base PIS/COFINS do tenant (`fiscal-settings`) para o
 * canal de operação aplicável (venda ou remessa) e a normaliza em
 * {@link BasePisCofinsConfig}.
 *
 * Domínio puro: aceita os tipos do `@msimulation-xml/fiscal-core` (não importa
 * Prisma) e não conhece transporte HTTP. Consumido pela camada `application`
 * (`tax-calculation.service.buildFiscalItem`).
 */

import {
  composicaoChannel as composicaoChannelCore,
  type BaseCalcAction,
  type ComposicaoLinha,
  type ComposicaoTributo,
  type FiscalEmitterSettingsData,
  type NFeTipoValue,
} from "@msimulation-xml/fiscal-core";
import type { FiscalOperationTipo } from "../entities/fiscal-context.entity.js";
import {
  LEGACY_BASE_PIS_COFINS_CONFIG,
  type BasePisCofinsConfig,
  type DeductFlag,
  type IncludeFlag,
} from "../entities/base-pis-cofins-config.entity.js";

function includeFromAction(action: BaseCalcAction | undefined): IncludeFlag {
  return action === "INCLUIR_NA_BASE" ? "INCLUDE" : "NONE";
}

function deductFromAction(action: BaseCalcAction | undefined): DeductFlag {
  return action === "SUBTRAIR_DA_BASE" ? "DEDUCT" : "NONE";
}

function lineAction(
  composicao: ComposicaoTributo,
  key: keyof ComposicaoTributo,
  channel: keyof ComposicaoLinha,
): BaseCalcAction | undefined {
  const line = composicao[key];
  if (!line || typeof line !== "object" || !("venda" in line)) return undefined;
  return (line as ComposicaoLinha)[channel];
}

/**
 * Projeta a `ComposicaoTributo` (que carrega ambos os canais) na
 * {@link BasePisCofinsConfig} para o canal indicado. Componentes ausentes na
 * `ComposicaoTributo` caem em `NONE`/default sem afetar a base.
 */
export function projectComposicaoPisCofins(
  composicao: ComposicaoTributo,
  channel: keyof ComposicaoLinha,
): BasePisCofinsConfig {
  return {
    frete: includeFromAction(lineAction(composicao, "frete", channel)),
    desconto: deductFromAction(lineAction(composicao, "desconto", channel)),
    icms: deductFromAction(lineAction(composicao, "icms", channel)),
    difal: deductFromAction(lineAction(composicao, "difal", channel)),
    fcpIcms: deductFromAction(lineAction(composicao, "fcpIcms", channel)),
    fcpDifal: deductFromAction(lineAction(composicao, "fcpDifal", channel)),
    ipi: includeFromAction(lineAction(composicao, "ipi", channel)),
    acrescimo: includeFromAction(lineAction(composicao, "acrescimoPreco", channel)),
  };
}

function composicaoChannelFromOperationTipo(
  operationTipo: FiscalOperationTipo | undefined,
): keyof ComposicaoLinha {
  return composicaoChannelCore((operationTipo ?? "VENDA") as NFeTipoValue);
}

/**
 * Resolve a {@link BasePisCofinsConfig} consumida pelo `tax-engine` a partir
 * das configurações do emissor + tipo da operação.
 *
 * - Sem `settings`: aplica o default conservador {@link LEGACY_BASE_PIS_COFINS_CONFIG}
 *   (frete na base, desconto subtraído, demais neutros — comportamento legado).
 * - Com `settings`: projeta `taxes.composicaoBaseCalculo.pisCofins` para o
 *   canal correspondente (`venda` para `VENDA`/`DEVOLUCAO`; `remessa` para
 *   remessas e retorno simbólico — espelha `composicaoChannel` do fiscal-core).
 */
export function resolveBasePisCofinsConfig(
  settings: FiscalEmitterSettingsData | null | undefined,
  operationTipo: FiscalOperationTipo | undefined,
): BasePisCofinsConfig {
  if (!settings) return { ...LEGACY_BASE_PIS_COFINS_CONFIG };
  const channel = composicaoChannelFromOperationTipo(operationTipo);
  return projectComposicaoPisCofins(
    settings.taxes.composicaoBaseCalculo.pisCofins,
    channel,
  );
}
