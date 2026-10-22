/**
 * Node builders auxiliares: autXML, protNFe, infAdic, infIntermed, infRespTec.
 *
 * @module builders/nodes/auxiliary.node
 */

import {
  simulationNProt,
  simulationProtDigVal,
  xTextoFromNfe,
  type MarketplaceIntermediador,
  type NfeInfRespTec,
} from "@msimulation-xml/fiscal-core";
import type { XmlObject } from "../../core/xml-serializer.js";
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
  const cStat = nfe.status === "AUTORIZADA" ? 100 : nfe.status === "REJEITADA" ? 539 : 103;
  const xMotivo = nfe.status === "AUTORIZADA" ? "Autorizado o uso da NF-e (SIMULAÇÃO)" : nfe.status;

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

/**
 * Monta `<infAdic>` com mensagens complementares e obsCont.
 *
 * Segmentos de `infCpl` (mensagemPadrao, composer da operação, linha DIFAL do emitter)
 * são unidos por **espaço único**, alinhado à fórmula ASCII da spec
 * `infcpl-fulfillment-ebazar` (sem `|` entre blocos).
 */
export function buildInfAdicNode(input: InfAdicNodeInput): XmlObject | null {
  const { nfe, emitter, extraInfCpl } = input;
  const parts = [emitter.mensagemInfCpl, extraInfCpl].filter((s) => s && s.trim());
  if (emitter.difal.aplica && emitter.difal.vDifal > 0) {
    parts.push(`DIFAL (${emitter.difal.mode}): R$ ${emitter.difal.vDifal.toFixed(2)}`);
  }
  const xTexto = xTextoFromNfe(nfe);
  if (parts.length === 0 && !xTexto) return null;

  const infAdic: XmlObject = {};
  if (parts.length > 0) infAdic.infCpl = parts.join(" ");
  if (xTexto) {
    infAdic.obsCont = { "@xCampo": "external_id", xTexto };
  }

  return { infAdic };
}

/**
 * Monta `<infIntermed>` (NT 2023.004). Prefere `fiscal.infIntermed`; completa com o intermediador
 * do marketplace. Sem intermediador no perfil, a nota não leva o bloco.
 */
export function buildInfIntermedNode(
  fiscal: Record<string, unknown>,
  intermediador: MarketplaceIntermediador | null,
): XmlObject | null {
  if (!intermediador) return null;

  const idCadIntTran = resolveIdCadIntTran(fiscal, intermediador.idCadIntTranPadrao);
  const raw = fiscal.infIntermed as Record<string, unknown> | undefined;
  const cnpjFromPayload = digitsOnly(String(raw?.CNPJ ?? ""));
  return {
    infIntermed: {
      CNPJ: cnpjFromPayload.length === 14 ? cnpjFromPayload : intermediador.cnpj,
      idCadIntTran,
    },
  };
}

/** Monta `<infRespTec>` da venda (com CSRT quando o marketplace informa). */
export function buildVendaInfRespTecNode(opts: NfeInfRespTec | null): XmlObject | null {
  if (!opts) return null;

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

/** Monta `<infRespTec>` de remessa, retorno e transferência (sem CSRT). */
export function buildRemessaInfRespTecNode(opts: NfeInfRespTec | null): XmlObject | null {
  if (!opts) return null;

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
