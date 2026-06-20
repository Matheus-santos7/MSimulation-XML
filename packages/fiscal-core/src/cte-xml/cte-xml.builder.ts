/**
 * Orquestra a montagem do documento CT-e (`cteProc`) como objeto XML.
 *
 * @module cte-xml/cte-xml.builder
 */

import { formatNfeDateTime } from "../nfe-datetime.js";
import {
  CTE_ML_EMIT,
  type CteFiscalPayload,
  type CteIcmsFrete,
  type CteParticipante,
} from "../cte-template.js";
import type { XmlDocument, XmlObject } from "../xml-serializer.js";
import { serializeXmlDocument } from "../xml-serializer.js";
import { buildCteEmitNode } from "./cte-emit.node.js";
import {
  buildCteImpNode,
  buildCteInfCteNormNode,
  buildCteVPrestNode,
} from "./cte-freight.node.js";
import { buildCteIdeNode } from "./cte-ide.node.js";
import { buildCteParticipanteNode } from "./cte-participante.node.js";
import { buildCteProtNode } from "./cte-prot.node.js";

const CTE_XMLNS = "http://www.portalfiscal.inf.br/cte";

export type BuildCteXmlDocumentInput = {
  chave: string;
  numero: number;
  serie: number;
  cfop: string;
  natOp: string;
  valor: number;
  valorCarga: number;
  pesoCarga: number;
  status: string;
  emitidoEm: string;
  fiscalPayload?: CteFiscalPayload | null;
  remetenteFallback?: CteParticipante;
};

function resolveDefaultIcms(valorFrete: number): CteIcmsFrete {
  return {
    cst: "00",
    vBC: valorFrete,
    pICMS: 12,
    vICMS: Math.round(valorFrete * 0.12 * 100) / 100,
  };
}

function mergeInfCteChildren(children: XmlObject[]): XmlObject {
  return children.reduce<XmlObject>((acc, node) => ({ ...acc, ...node }), {});
}

/**
 * Monta o documento XML completo do CT-e (sem assinatura).
 */
export function buildCteXmlDocument(input: BuildCteXmlDocumentInput): XmlDocument {
  const fp = input.fiscalPayload;
  const dhEmi = formatNfeDateTime(input.emitidoEm);
  const icms = fp?.icms ?? resolveDefaultIcms(input.valor);
  const rota = fp?.rota;

  const remetente = fp?.remetente ?? input.remetenteFallback;
  const destinatario = fp?.destinatario;
  const nfeChaveRef = fp?.nfeChaveRef ?? "";

  const infCteChildren: XmlObject[] = [
    buildCteIdeNode({
      chave: input.chave,
      cfop: input.cfop,
      natOp: input.natOp,
      serie: input.serie,
      numero: input.numero,
      dhEmi,
      cMunIni: rota?.cMunIni ?? CTE_ML_EMIT.codigoMunicipio,
      xMunIni: rota?.xMunIni ?? CTE_ML_EMIT.municipio,
      ufIni: rota?.ufIni ?? "RJ",
      cMunFim: rota?.cMunFim ?? CTE_ML_EMIT.codigoMunicipio,
      xMunFim: rota?.xMunFim ?? CTE_ML_EMIT.municipio,
      ufFim: rota?.ufFim ?? "RJ",
    }),
    buildCteEmitNode(),
  ];

  if (remetente) {
    infCteChildren.push(buildCteParticipanteNode("rem", remetente));
  }
  if (destinatario) {
    infCteChildren.push(buildCteParticipanteNode("dest", destinatario));
  }

  infCteChildren.push(
    buildCteVPrestNode(input.valor),
    buildCteImpNode(icms),
    buildCteInfCteNormNode({
      valorCarga: input.valorCarga,
      pesoCarga: input.pesoCarga,
      nfeChaveRef: nfeChaveRef || undefined,
      dPrev: nfeChaveRef ? dhEmi.slice(0, 10) : undefined,
    }),
  );

  return {
    declaration: { version: "1.0", encoding: "UTF-8" },
    root: {
      cteProc: {
        "@xmlns": CTE_XMLNS,
        "@versao": "4.00",
        CTe: {
          infCte: {
            "@Id": `CTe${input.chave}`,
            "@versao": "4.00",
            ...mergeInfCteChildren(infCteChildren),
          },
        },
        ...buildCteProtNode({
          chave: input.chave,
          numero: input.numero,
          dhEmi,
          status: input.status,
        }),
      },
    },
  };
}

/**
 * Serializa CT-e simulado para string XML (sem assinatura).
 */
export function serializeCteXmlDocument(input: BuildCteXmlDocumentInput): string {
  return serializeXmlDocument(buildCteXmlDocument(input));
}
