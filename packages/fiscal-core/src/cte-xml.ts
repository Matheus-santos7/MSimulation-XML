/**
 * Gerador XML CT-e v4.00 — simulação alinhada ao layout oficial (modelo ML).
 */

import { formatNfeDateTime } from "./nfe-datetime.js";
import {
  CTE_ML_EMIT,
  CTE_RNTRC,
  type CteFiscalPayload,
  type CteParticipante,
} from "./cte-template.js";
import { simulationNProt } from "./nprot.js";
import {
  CTE_SIGNATURE_CONFIG,
  injectSimulationSignature,
  simulationProtDigVal,
} from "./xml-signature.js";

export type CTeXmlInput = {
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
  /** @deprecated Preferir fiscalPayload.remetente */
  remetenteFallback?: CteParticipante;
};

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function ufToCodigo(uf: string): number {
  const map: Record<string, number> = {
    AC: 12, AL: 27, AM: 13, AP: 16, BA: 29, CE: 23, DF: 53, ES: 32, GO: 52,
    MA: 21, MG: 31, MS: 50, MT: 51, PA: 15, PB: 25, PE: 26, PI: 22, PR: 41,
    RJ: 33, RN: 24, RO: 11, RR: 14, RS: 43, SC: 42, SE: 28, SP: 35, TO: 17,
  };
  return map[uf.toUpperCase()] ?? 35;
}

function participanteDocXml(doc: string): { tag: string; value: string } {
  const digits = doc.replace(/\D/g, "");
  if (digits.length === 11) return { tag: "CPF", value: digits };
  return { tag: "CNPJ", value: digits.padStart(14, "0").slice(-14) };
}

function participanteBlock(
  role: "rem" | "dest",
  p: CteParticipante,
): string {
  const { tag, value } = participanteDocXml(p.doc);
  const ieXml =
    p.ie && p.ie.replace(/\D/g, "").length > 0
      ? `\n        <IE>${p.ie.replace(/\D/g, "")}</IE>`
      : "";
  const xCpl = p.endereco.complemento
    ? `\n          <xCpl>${xmlEscape(p.endereco.complemento)}</xCpl>`
    : "";
  const enderTag = role === "rem" ? "enderReme" : "enderDest";
  return `      <${role}>
        <${tag}>${value}</${tag}>${ieXml}
        <xNome>${xmlEscape(p.nome)}</xNome>
        <${enderTag}>
          <xLgr>${xmlEscape(p.endereco.logradouro)}</xLgr>
          <nro>${xmlEscape(p.endereco.numero)}</nro>${xCpl}
          <xBairro>${xmlEscape(p.endereco.bairro)}</xBairro>
          <cMun>${p.endereco.codigoMunicipio}</cMun>
          <xMun>${xmlEscape(p.endereco.municipio)}</xMun>
          <CEP>${p.endereco.cep.replace(/\D/g, "")}</CEP>
          <UF>${p.endereco.uf}</UF>
        </${enderTag}>
      </${role}>`;
}

export function buildCTeXML(cte: CTeXmlInput): string {
  const fp = cte.fiscalPayload;
  const id = "CTe" + cte.chave;
  const dhEmi = formatNfeDateTime(cte.emitidoEm);
  const cUF = ufToCodigo(CTE_ML_EMIT.uf);
  const vFrete = cte.valor;
  const vCarga = cte.valorCarga;
  const icms = fp?.icms ?? {
    cst: "00",
    vBC: vFrete,
    pICMS: 12,
    vICMS: Math.round(vFrete * 0.12 * 100) / 100,
  };

  const rota = fp?.rota;
  const cMunIni = rota?.cMunIni ?? CTE_ML_EMIT.codigoMunicipio;
  const xMunIni = rota?.xMunIni ?? CTE_ML_EMIT.municipio;
  const ufIni = rota?.ufIni ?? "RJ";
  const cMunFim = rota?.cMunFim ?? CTE_ML_EMIT.codigoMunicipio;
  const xMunFim = rota?.xMunFim ?? CTE_ML_EMIT.municipio;
  const ufFim = rota?.ufFim ?? "RJ";

  const remetente = fp?.remetente ?? cte.remetenteFallback;
  const destinatario = fp?.destinatario;
  const nfeChave = fp?.nfeChaveRef ?? "";
  const dPrev = dhEmi.slice(0, 10);

  const infNFeXml = nfeChave
    ? `
          <infNFe>
            <chave>${nfeChave}</chave>
            <dPrev>${dPrev}</dPrev>
          </infNFe>`
    : "";

  const remXml = remetente ? participanteBlock("rem", remetente) : "";
  const destXml = destinatario ? participanteBlock("dest", destinatario) : "";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cteProc xmlns="http://www.portalfiscal.inf.br/cte" versao="4.00">
  <CTe>
    <infCte Id="${id}" versao="4.00">
      <ide>
        <cUF>${cUF}</cUF>
        <cCT>${cte.chave.slice(35, 43)}</cCT>
        <CFOP>${cte.cfop}</CFOP>
        <natOp>${xmlEscape(cte.natOp)}</natOp>
        <mod>57</mod>
        <serie>${cte.serie}</serie>
        <nCT>${cte.numero}</nCT>
        <dhEmi>${dhEmi}</dhEmi>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>${cte.chave.slice(-1)}</cDV>
        <tpAmb>2</tpAmb>
        <tpCTe>0</tpCTe>
        <procEmi>0</procEmi>
        <verProc>cte-simulation-4.00</verProc>
        <cMunEnv>${CTE_ML_EMIT.codigoMunicipio}</cMunEnv>
        <xMunEnv>${xmlEscape(CTE_ML_EMIT.municipio)}</xMunEnv>
        <UFEnv>${CTE_ML_EMIT.uf}</UFEnv>
        <modal>01</modal>
        <tpServ>0</tpServ>
        <cMunIni>${cMunIni}</cMunIni>
        <xMunIni>${xmlEscape(xMunIni)}</xMunIni>
        <UFIni>${ufIni}</UFIni>
        <cMunFim>${cMunFim}</cMunFim>
        <xMunFim>${xmlEscape(xMunFim)}</xMunFim>
        <UFFim>${ufFim}</UFFim>
        <retira>1</retira>
        <indIEToma>1</indIEToma>
        <toma3><toma>0</toma></toma3>
      </ide>
      <emit>
        <CNPJ>${CTE_ML_EMIT.cnpj}</CNPJ>
        <IE>${CTE_ML_EMIT.ie}</IE>
        <xNome>${xmlEscape(CTE_ML_EMIT.nome)}</xNome>
        <enderEmit>
          <xLgr>${xmlEscape(CTE_ML_EMIT.logradouro)}</xLgr>
          <nro>${CTE_ML_EMIT.numero}</nro>
          <xBairro>${xmlEscape(CTE_ML_EMIT.bairro)}</xBairro>
          <cMun>${CTE_ML_EMIT.codigoMunicipio}</cMun>
          <xMun>${xmlEscape(CTE_ML_EMIT.municipio)}</xMun>
          <CEP>${CTE_ML_EMIT.cep}</CEP>
          <UF>${CTE_ML_EMIT.uf}</UF>
        </enderEmit>
        <CRT>3</CRT>
      </emit>
${remXml}
${destXml}
      <vPrest>
        <vTPrest>${vFrete.toFixed(2)}</vTPrest>
        <vRec>${vFrete.toFixed(2)}</vRec>
      </vPrest>
      <imp>
        <ICMS>
          <ICMS00>
            <CST>${icms.cst}</CST>
            <vBC>${icms.vBC.toFixed(2)}</vBC>
            <pICMS>${icms.pICMS.toFixed(2)}</pICMS>
            <vICMS>${icms.vICMS.toFixed(2)}</vICMS>
          </ICMS00>
        </ICMS>
        <vTotTrib>${icms.vICMS.toFixed(2)}</vTotTrib>
      </imp>
      <infCTeNorm>
        <infCarga>
          <vCarga>${vCarga.toFixed(2)}</vCarga>
          <proPred>CAIXA</proPred>
          <infQ>
            <cUnid>01</cUnid>
            <tpMed>PESO BRUTO</tpMed>
            <qCarga>${cte.pesoCarga.toFixed(4)}</qCarga>
          </infQ>
        </infCarga>
        <infDoc>${infNFeXml}
        </infDoc>
        <infModal versaoModal="4.00">
          <rodo><RNTRC>${CTE_RNTRC}</RNTRC></rodo>
        </infModal>
      </infCTeNorm>
    </infCte>
  </CTe>
  <protCTe versao="4.00">
    <infProt>
      <tpAmb>2</tpAmb>
      <verAplic>SIMULATION-CTe</verAplic>
      <chCTe>${cte.chave}</chCTe>
      <dhRecbto>${dhEmi}</dhRecbto>
      <nProt>${simulationNProt(cte.numero, "333260367974")}</nProt>
      <digVal>${simulationProtDigVal(cte.chave)}</digVal>
      <cStat>${cte.status === "AUTORIZADA" ? 100 : 103}</cStat>
      <xMotivo>${cte.status === "AUTORIZADA" ? "Autorizado o uso do CT-e (SIMULAÇÃO)" : cte.status}</xMotivo>
    </infProt>
  </protCTe>
</cteProc>`;
  return injectSimulationSignature(xml, CTE_SIGNATURE_CONFIG);
}
