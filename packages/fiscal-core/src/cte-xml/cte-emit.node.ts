import type { CteEmitente } from "../cte-emitente.js";
import type { XmlObject } from "../xml-serializer.js";

/** Monta emitente Ebazar conforme CD ML ou fallback. */
export function buildCteEmitNode(emitente: CteEmitente): XmlObject {
  return {
    emit: {
      CNPJ: emitente.cnpj,
      IE: emitente.ie,
      xNome: emitente.nome,
      enderEmit: {
        xLgr: emitente.logradouro,
        nro: emitente.numero,
        xBairro: emitente.bairro,
        cMun: emitente.codigoMunicipio,
        xMun: emitente.municipio,
        CEP: emitente.cep,
        UF: emitente.uf,
      },
      CRT: 3,
    },
  };
}
