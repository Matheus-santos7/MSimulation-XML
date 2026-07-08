/**
 * Node builders para `<vPrest>`, `<imp>` e `<infCTeNorm>` do CT-e.
 *
 * @module cte-xml/cte-freight.node
 */

import { CTE_RNTRC, type CteIbsCbsFrete, type CteIcmsFrete } from "../cte-template.js";
import type { XmlObject } from "../xml-serializer.js";
import { formatMoney2, formatWeight4 } from "./cte-xml.util.js";

/** Monta valores da prestação de serviço. */
export function buildCteVPrestNode(valorFrete: number): XmlObject {
  const formatted = formatMoney2(valorFrete);
  return {
    vPrest: {
      vTPrest: formatted,
      vRec: formatted,
    },
  };
}

/** Monta grupo `<imp>` com ICMS00, IBSCBS (reforma) e vTotDFe. */
export function buildCteImpNode(icms: CteIcmsFrete, ibsCbs?: CteIbsCbsFrete): XmlObject {
  const imp: XmlObject = {
    ICMS: {
      ICMS00: {
        CST: icms.cst,
        vBC: formatMoney2(icms.vBC),
        pICMS: formatMoney2(icms.pICMS),
        vICMS: formatMoney2(icms.vICMS),
      },
    },
    vTotTrib: formatMoney2(icms.vICMS),
  };

  if (ibsCbs) {
    imp.IBSCBS = {
      CST: ibsCbs.cst,
      cClassTrib: ibsCbs.cClassTrib,
      gIBSCBS: {
        vBC: formatMoney2(ibsCbs.vBC),
        gIBSUF: {
          pIBSUF: formatMoney2(ibsCbs.pIBSUF),
          vIBSUF: formatMoney2(ibsCbs.vIBSUF),
        },
        gIBSMun: {
          pIBSMun: formatMoney2(ibsCbs.pIBSMun),
          vIBSMun: formatMoney2(ibsCbs.vIBSMun),
        },
        vIBS: formatMoney2(ibsCbs.vIBS),
        gCBS: {
          pCBS: formatMoney2(ibsCbs.pCBS),
          vCBS: formatMoney2(ibsCbs.vCBS),
        },
      },
    };
    imp.vTotDFe = formatMoney2(ibsCbs.vTotDFe);
  }

  return { imp };
}

export type CteInfCteNormNodeInput = {
  valorCarga: number;
  pesoCarga: number;
  nfeChaveRef?: string;
  dPrev?: string;
};

/** Monta `<infCTeNorm>` com carga, documentos vinculados e modal rodoviário. */
export function buildCteInfCteNormNode(input: CteInfCteNormNodeInput): XmlObject {
  const infDoc: XmlObject = {};
  if (input.nfeChaveRef) {
    infDoc.infNFe = {
      chave: input.nfeChaveRef,
      dPrev: input.dPrev ?? "",
    };
  }

  return {
    infCTeNorm: {
      infCarga: {
        vCarga: formatMoney2(input.valorCarga),
        proPred: "CAIXA",
        infQ: {
          cUnid: "01",
          tpMed: "PESO BRUTO",
          qCarga: formatWeight4(input.pesoCarga),
        },
      },
      infDoc,
      infModal: {
        "@versaoModal": "4.00",
        rodo: { RNTRC: CTE_RNTRC },
      },
    },
  };
}
