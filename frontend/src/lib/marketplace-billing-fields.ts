import type { FiscalEmitterSettingsData } from "./fiscal-emitter-settings-types";
import type { MarketplaceBillingOverrides } from "./fiscal-api/marketplaces";

type BasicSettings = FiscalEmitterSettingsData["basic"];

/** Campo de `basic` que um marketplace pode sobrescrever na tela de faturador. */
export type BasicOverrideField = {
  key: keyof Pick<
    BasicSettings,
    "formaFaturamento" | "perfilVendedor" | "logisticaPadrao" | "retornoSimbolicoNatureza"
  >;
  label: string;
  options: readonly { value: string; label: string }[];
};

export const BASIC_OVERRIDE_FIELDS: readonly BasicOverrideField[] = [
  {
    key: "formaFaturamento",
    label: "Como as notas serão emitidas",
    options: [
      { value: "EMISSOR_PROPRIO", label: "Emissor próprio" },
      { value: "EMISSOR_MARKETPLACE", label: "Emissor do marketplace" },
    ],
  },
  {
    key: "perfilVendedor",
    label: "Perfil do vendedor (árvore CFOP)",
    options: [
      { value: "comercio", label: "Comércio (revenda)" },
      { value: "industria", label: "Indústria (produção própria)" },
    ],
  },
  {
    key: "logisticaPadrao",
    label: "Logística padrão da venda",
    options: [
      { value: "armazem_geral", label: "Armazém geral / Full (5105–6106)" },
      { value: "estoque_proprio", label: "Estoque próprio (5101/5102/6107/6108/ST)" },
    ],
  },
  {
    key: "retornoSimbolicoNatureza",
    label: "CFOP retorno simbólico (natureza)",
    options: [
      { value: "outras_entradas", label: "Outras entradas → 1949 / 2949" },
      { value: "retorno_venda_fora", label: "Retorno venda fora → 1904 / 2904" },
      { value: "retorno_deposito", label: "Retorno depósito/armazém → 1907 / 2907" },
    ],
  },
];

/** Valor do `<select>` que significa "herdar do padrão da empresa". */
export const INHERIT = "";

/** Valores escolhidos na tela: `INHERIT` ou o valor sobrescrito; `autXmlCpfs: null` herda. */
export type MarketplaceBillingFormValues = {
  basic: Record<BasicOverrideField["key"], string>;
  autXmlCpfs: string[] | null;
};

export function optionLabel(field: BasicOverrideField, value: string | undefined): string {
  if (!value) return "Automático";

  return field.options.find((o) => o.value === value)?.label ?? value;
}

/** Estado inicial da tela a partir da sobrescrita salva. */
export function toFormValues(overrides: MarketplaceBillingOverrides): MarketplaceBillingFormValues {
  const basic = Object.fromEntries(
    BASIC_OVERRIDE_FIELDS.map((field) => [field.key, String(overrides.basic?.[field.key] ?? INHERIT)]),
  ) as MarketplaceBillingFormValues["basic"];

  return { basic, autXmlCpfs: overrides.nfe?.autXmlCpfs ?? null };
}

/** Quantos campos o marketplace muda em relação ao padrão. */
export function countOverrides(overrides: MarketplaceBillingOverrides): number {
  return ["basic", "taxes", "nfe"].reduce(
    (total, group) =>
      total + Object.keys((overrides as Record<string, object | undefined>)[group] ?? {}).length,
    0,
  );
}

/**
 * Nova sobrescrita: os campos desta tela vêm do formulário; o que a tela não edita (ex.:
 * impostos gravados por outra via) é preservado. Grupo vazio sai do objeto.
 */
export function buildOverrides(
  current: MarketplaceBillingOverrides,
  values: MarketplaceBillingFormValues,
): MarketplaceBillingOverrides {
  const managedBasic = new Set<string>(BASIC_OVERRIDE_FIELDS.map((f) => f.key));
  const keptBasic = Object.fromEntries(
    Object.entries(current.basic ?? {}).filter(([key]) => !managedBasic.has(key)),
  );
  const chosenBasic = Object.fromEntries(
    Object.entries(values.basic).filter(([, value]) => value !== INHERIT),
  );
  const basic = { ...keptBasic, ...chosenBasic };

  const keptNfe = Object.fromEntries(
    Object.entries(current.nfe ?? {}).filter(([key]) => key !== "autXmlCpfs"),
  );
  const nfe = values.autXmlCpfs ? { ...keptNfe, autXmlCpfs: values.autXmlCpfs } : keptNfe;

  return {
    ...(Object.keys(basic).length > 0 ? { basic } : {}),
    ...(current.taxes && Object.keys(current.taxes).length > 0 ? { taxes: current.taxes } : {}),
    ...(Object.keys(nfe).length > 0 ? { nfe } : {}),
  };
}

/** CPFs do autXML digitados um por linha ou separados por vírgula (só dígitos). */
export function parseCpfList(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((cpf) => cpf.replace(/\D/g, ""))
    .filter((cpf) => cpf.length > 0);
}
