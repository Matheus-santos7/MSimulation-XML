/**
 * Node builders auxiliares: autXML, protNFe, infAdic, infIntermed, infRespTec.
 *
 * @module builders/nodes/auxiliary.node
 */

import {
  ML_INF_RESP_TEC,
  simulationNProt,
  simulationProtDigVal,
  xTextoFromNfe,
  VENDA_ML_INF_RESP_TEC,
} from "@msimulation-xml/fiscal-core";
import type { XmlObject } from "../../core/xml-serializer.js";
import {
  REMESSA_ML_INTERMED_CNPJ,
  REMESSA_ML_INTERMED_ID,
} from "../../constants.js";
import { resolveIdCadIntTran } from "../../fiscal/fiscal-xml.util.js";
import type { resolveEmitterFromPayload } from "../../resolve-emitter.js";
import type { NFeXmlInput } from "../../types.js";
import { digitsOnly } from "./builder.util.js";

/** Monta blocos `<autXML>`. */
export function buildAutXmlNodes(cpfs: readonly string[]): XmlObject[] {
  return cpfs.map((cpf) => ({
    autXML: { CPF: digitsOnly(cpf) },
  }));
}

/** Monta `<protNFe>` de simulação. */
export function buildProtNFeNode(nfe: NFeXmlInput, dhEmi: string): XmlObject {
  const cStat =
    nfe.status === "AUTORIZADA" ? 100 : nfe.status === "REJEITADA" ? 539 : 103;
  const xMotivo =
    nfe.status === "AUTORIZADA" ? "Autorizado o uso da NF-e (SIMULAÇÃO)" : nfe.status;

  return {
    protNFe: {
      "@versao": "4.00",
      infProt: {
        tpAmb: 2,
        verAplic: "SIMULATION-3.2",
        chNFe: nfe.chave,
        dhRecbto: dhEmi,
        nProt: simulationNProt(nfe.numero),
        digVal: simulationProtDigVal(nfe.chave),
        cStat,
        xMotivo,
      },
    },
  };
}

export type InfAdicNodeInput = {
  nfe: NFeXmlInput;
  emitter: ReturnType<typeof resolveEmitterFromPayload>;
  extraInfCpl?: string;
};

/** Monta `<infAdic>` com mensagens complementares e obsCont. */
export function buildInfAdicNode(input: InfAdicNodeInput): XmlObject | null {
  const { nfe, emitter, extraInfCpl } = input;
  const parts = [emitter.mensagemInfCpl, extraInfCpl].filter((s) => s && s.trim());
  if (emitter.difal.aplica && emitter.difal.vDifal > 0) {
    parts.push(`DIFAL (${emitter.difal.mode}): R$ ${emitter.difal.vDifal.toFixed(2)}`);
  }
  const xTexto = xTextoFromNfe(nfe);
  if (parts.length === 0 && !xTexto) return null;

  const infAdic: XmlObject = {};
  if (parts.length > 0) infAdic.infCpl = parts.join(" | ");
  if (xTexto) {
    infAdic.obsCont = { "@xCampo": "external_id", xTexto };
  }

  return { infAdic };
}

/** Monta `<infIntermed>` (marketplace). */
export function buildInfIntermedNode(fiscal: Record<string, unknown>): XmlObject {
  const idCadIntTran = resolveIdCadIntTran(fiscal, REMESSA_ML_INTERMED_ID);
  return {
    infIntermed: {
      CNPJ: REMESSA_ML_INTERMED_CNPJ,
      idCadIntTran,
    },
  };
}

/** Monta `<infRespTec>` para venda ML. */
export function buildVendaInfRespTecNode(): XmlObject {
  const opts = VENDA_ML_INF_RESP_TEC;
  const node: XmlObject = {
    CNPJ: digitsOnly(opts.cnpj),
    xContato: opts.xContato,
    email: opts.email,
    fone: digitsOnly(opts.fone),
  };
  if (opts.idCSRT?.trim() && opts.hashCSRT?.trim()) {
    node.idCSRT = opts.idCSRT;
    node.hashCSRT = opts.hashCSRT;
  }
  return { infRespTec: node };
}

/** Monta `<infRespTec>` para remessa ML fulfillment. */
export function buildRemessaInfRespTecNode(): XmlObject {
  const opts = ML_INF_RESP_TEC;
  return {
    infRespTec: {
      CNPJ: digitsOnly(opts.cnpj),
      xContato: opts.xContato,
      email: opts.email,
      fone: digitsOnly(opts.fone),
    },
  };
}

/** Monta `<pag>` zerado (remessa). */
export function buildRemessaPagNode(): XmlObject {
  return {
    pag: {
      detPag: {
        indPag: 0,
        tPag: "90",
        vPag: "0.00",
      },
    },
  };
}

/** Monta `<pag>` da venda ML com cartão. */
export function buildVendaPagNode(vNF: number, fiscal: Record<string, unknown>): XmlObject {
  const pagamento = (fiscal.pagamento as Record<string, unknown> | undefined) ?? {};
  const card = (pagamento.card as Record<string, unknown> | undefined) ?? {};
  const tPag = String(pagamento.tPag ?? "03");
  const cAut = String(card.cAut ?? "837812");
  const tBand = String(card.tBand ?? "01");
  const tpIntegra = String(card.tpIntegra ?? "1");
  const cnpj = String(card.cnpj ?? "03007331000141").replace(/\D/g, "");

  return {
    pag: {
      detPag: {
        indPag: 0,
        tPag,
        vPag: vNF.toFixed(2),
        card: {
          tpIntegra,
          CNPJ: cnpj,
          tBand,
          cAut,
        },
      },
    },
  };
}
