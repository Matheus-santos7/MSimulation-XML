/**
 * Tipos compartilhados pelos builders Strategy de NF-e.
 *
 * @module builders/builder.types
 */

import type { FiscalEmitterSettingsData } from "@msimulation-xml/fiscal-core";
import type { XmlObject } from "../core/xml-serializer.js";
import type { NfeProcDocument } from "../core/nfe-ast.types.js";
import type { parseEngineFromFiscalPayload } from "../fiscal-engine-xml.js";
import type { resolveEmitterFromPayload } from "../resolve-emitter.js";
import type { EmitenteXml, NFeXmlInput, ProductXmlInput } from "../types.js";

/** Entrada comum para todos os builders de NF-e. */
export type NFeBuilderInput = {
  nfe: NFeXmlInput;
  emit: EmitenteXml;
  product?: ProductXmlInput;
  products?: ProductXmlInput[];
  emitterSettings?: FiscalEmitterSettingsData | null;
};

/** Contexto base resolvido uma vez por builder. */
export type BaseNFeBuildContext = {
  nfe: NFeXmlInput;
  emit: EmitenteXml;
  product?: ProductXmlInput;
  products?: ProductXmlInput[];
  emitterSettings?: FiscalEmitterSettingsData | null;
  fiscal: Record<string, unknown>;
  emitter: ReturnType<typeof resolveEmitterFromPayload>;
  engine: ReturnType<typeof parseEngineFromFiscalPayload>;
  dhEmi: string;
  autXmlCpfs: readonly string[];
};

/** Opções do grupo `<ide>` variáveis por estratégia (venda vs remessa). */
export type IdeBuildOptions = {
  stockUf: string;
  /** UF do emitente para `<cUF>`; default = stockUf (remessas). */
  cUfIde?: string;
  /** IBGE para `<cMunFG>`; default = município do emitente. */
  cMunFGIde?: string;
  idDest: number;
  finNFe: number;
  indFinal: number;
  indPres: number;
  indIntermed: number;
  verProc: string;
  tpNF: number;
  includeNfRef: boolean;
};

/** Resultado de `build()` — documento AST pronto para serialização. */
export type NFeBuilderResult = NfeProcDocument;

/** Contrato mínimo de um builder concreto. */
export type INFeBuilder = {
  build(): NFeBuilderResult;
  buildXml(): string;
};

/** Nó `<det>` ou lista de itens. */
export type DetBuildResult = XmlObject | XmlObject[];
