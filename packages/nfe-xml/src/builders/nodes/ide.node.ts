/**
 * Node builder para o grupo `<ide>`.
 *
 * @module builders/nodes/ide.node
 */

import { ML_NFE_VER_PROC } from "@msimulation-xml/fiscal-core";
import type { XmlObject } from "../../core/xml-serializer.js";
import type { NFeXmlInput } from "../../types.js";
import { ufToCodigo } from "../../constants.js";
import type { IdeBuildOptions } from "../builder.types.js";

export type IdeNodeInput = {
  nfe: NFeXmlInput;
  emitUf: string;
  cMunFG: string;
  dhEmi: string;
  options: IdeBuildOptions;
};

/**
 * Monta nó `<ide>` com opções específicas da estratégia (venda, remessa, etc.).
 */
export function buildIdeNode(input: IdeNodeInput): XmlObject {
  const { nfe, emitUf, cMunFG, dhEmi, options } = input;
  const cUF = ufToCodigo(emitUf);

  const ide: XmlObject = {
    cUF,
    cNF: nfe.chave.slice(35, 43),
    natOp: nfe.natOp,
    mod: 55,
    serie: nfe.serie,
    nNF: nfe.numero,
    dhEmi,
    dhSaiEnt: dhEmi,
    tpNF: options.tpNF,
    idDest: options.idDest,
    cMunFG,
    tpImp: 1,
    tpEmis: 1,
    cDV: nfe.chave.slice(-1),
    tpAmb: 2,
    finNFe: options.finNFe,
    indFinal: options.indFinal,
    indPres: options.indPres,
    indIntermed: options.indIntermed,
    procEmi: 0,
    verProc: options.verProc,
  };

  if (options.includeNfRef && nfe.nfeReferenciaChave) {
    const k = nfe.nfeReferenciaChave.replace(/\D/g, "");
    if (k.length === 44) {
      ide.NFref = { refNFe: k };
    }
  }

  return { ide };
}

/** Defaults de ide para NF-e de venda ML. */
export function vendaIdeOptions(stockUf: string, destUf: string): IdeBuildOptions {
  return {
    stockUf,
    idDest: stockUf.toUpperCase() === destUf.toUpperCase() ? 1 : 2,
    finNFe: 1,
    indFinal: 1,
    indPres: 2,
    indIntermed: 1,
    verProc: ML_NFE_VER_PROC,
    tpNF: 1,
    includeNfRef: true,
  };
}

/** Defaults de ide para remessa física / simbólica ML. */
export function remessaIdeOptions(emitUf: string, destUf: string, tipo: NFeXmlInput["tipo"]): IdeBuildOptions {
  return {
    stockUf: emitUf,
    idDest: emitUf.toUpperCase() === destUf.toUpperCase() ? 1 : 2,
    finNFe: 1,
    indFinal: 0,
    indPres: 2,
    indIntermed: 1,
    verProc: "invoice-SIMULATION",
    tpNF: 1,
    includeNfRef: tipo !== "REMESSA",
  };
}

/** Defaults de ide para retorno simbólico ML (`tpNF=0`, entrada). */
export function retornoIdeOptions(emitUf: string, destUf: string): IdeBuildOptions {
  return {
    stockUf: emitUf,
    idDest: emitUf.toUpperCase() === destUf.toUpperCase() ? 1 : 2,
    finNFe: 1,
    indFinal: 0,
    indPres: 2,
    indIntermed: 1,
    verProc: "invoice-SIMULATION",
    tpNF: 0,
    includeNfRef: true,
  };
}

/** Defaults de ide para devolução (`tpNF=0`, `finNFe=4`). */
export function devolucaoIdeOptions(stockUf: string, destUf: string): IdeBuildOptions {
  return {
    ...vendaIdeOptions(stockUf, destUf),
    tpNF: 0,
    finNFe: 4,
  };
}
