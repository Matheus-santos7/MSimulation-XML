/**
 * Node builder para `<emit>` do CT-e (transportador ML simulado).
 *
 * @module cte-xml/cte-emit.node
 */

import { CTE_ML_EMIT } from "../cte-template.js";
import type { XmlObject } from "../xml-serializer.js";

/** Monta emitente fixo Ebazar conforme template ML. */
export function buildCteEmitNode(): XmlObject {
  return {
    emit: {
      CNPJ: CTE_ML_EMIT.cnpj,
      IE: CTE_ML_EMIT.ie,
      xNome: CTE_ML_EMIT.nome,
      enderEmit: {
        xLgr: CTE_ML_EMIT.logradouro,
        nro: CTE_ML_EMIT.numero,
        xBairro: CTE_ML_EMIT.bairro,
        cMun: CTE_ML_EMIT.codigoMunicipio,
        xMun: CTE_ML_EMIT.municipio,
        CEP: CTE_ML_EMIT.cep,
        UF: CTE_ML_EMIT.uf,
      },
      CRT: 3,
    },
  };
}
