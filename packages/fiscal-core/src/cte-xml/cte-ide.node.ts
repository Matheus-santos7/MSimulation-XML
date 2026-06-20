/**
 * Node builder para `<ide>` do CT-e.
 *
 * @module cte-xml/cte-ide.node
 */

import { CTE_ML_EMIT } from "../cte-template.js";
import type { XmlObject } from "../xml-serializer.js";
import { ufToCodigo } from "./cte-xml.util.js";

export type CteIdeNodeInput = {
  chave: string;
  cfop: string;
  natOp: string;
  serie: number;
  numero: number;
  dhEmi: string;
  cMunIni: string;
  xMunIni: string;
  ufIni: string;
  cMunFim: string;
  xMunFim: string;
  ufFim: string;
};

/** Monta grupo `<ide>` com identificação do CT-e simulado. */
export function buildCteIdeNode(input: CteIdeNodeInput): XmlObject {
  return {
    ide: {
      cUF: ufToCodigo(CTE_ML_EMIT.uf),
      cCT: input.chave.slice(35, 43),
      CFOP: input.cfop,
      natOp: input.natOp,
      mod: 57,
      serie: input.serie,
      nCT: input.numero,
      dhEmi: input.dhEmi,
      tpImp: 1,
      tpEmis: 1,
      cDV: input.chave.slice(-1),
      tpAmb: 2,
      tpCTe: 0,
      procEmi: 0,
      verProc: "cte-simulation-4.00",
      cMunEnv: CTE_ML_EMIT.codigoMunicipio,
      xMunEnv: CTE_ML_EMIT.municipio,
      UFEnv: CTE_ML_EMIT.uf,
      modal: "01",
      tpServ: 0,
      cMunIni: input.cMunIni,
      xMunIni: input.xMunIni,
      UFIni: input.ufIni,
      cMunFim: input.cMunFim,
      xMunFim: input.xMunFim,
      UFFim: input.ufFim,
      retira: 1,
      indIEToma: 1,
      toma3: { toma: 0 },
    },
  };
}
