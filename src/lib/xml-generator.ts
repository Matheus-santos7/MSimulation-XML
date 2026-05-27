/**
 * NFe v4.00 XML generator — SIMULATION ONLY.
 * Produces a structurally faithful nfeProc XML so the UI can render real-looking
 * documents in the inspector. The <Signature> block is a deterministic FAKE
 * marker — never use this output against real SEFAZ.
 */

import type { NFe } from "./fiscal-mock";

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function buildNFeXML(nfe: NFe, emit: { cnpj: string; xNome: string; ie: string; uf: string }): string {
  const id = "NFe" + nfe.chave;
  const aamm = nfe.chave.slice(2, 6);
  const dhEmi = nfe.emitidaEm;

  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="${id}" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <cNF>${nfe.chave.slice(35, 43)}</cNF>
        <natOp>${xmlEscape(nfe.natOp)}</natOp>
        <mod>55</mod>
        <serie>${nfe.serie}</serie>
        <nNF>${nfe.numero}</nNF>
        <dhEmi>${dhEmi}</dhEmi>
        <tpNF>1</tpNF>
        <idDest>${nfe.destinatario.uf === emit.uf ? 1 : 2}</idDest>
        <cMunFG>3550308</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>${nfe.chave.slice(-1)}</cDV>
        <tpAmb>2</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>1</indFinal>
        <indPres>2</indPres>
        <procEmi>0</procEmi>
        <verProc>fiscal-engine-3.2-SIMULATION</verProc>
      </ide>
      <emit>
        <CNPJ>${emit.cnpj.replace(/\D/g, "")}</CNPJ>
        <xNome>${xmlEscape(emit.xNome)}</xNome>
        <IE>${emit.ie.replace(/\D/g, "")}</IE>
        <CRT>3</CRT>
      </emit>
      <dest>
        <xNome>${xmlEscape(nfe.destinatario.nome)}</xNome>
        <indIEDest>9</indIEDest>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>SKU-${nfe.numero}</cProd>
          <cEAN>SEM GTIN</cEAN>
          <xProd>${xmlEscape(nfe.natOp)}</xProd>
          <NCM>${nfe.ncm}</NCM>
          <CFOP>${nfe.cfop}</CFOP>
          <uCom>UN</uCom>
          <qCom>1.0000</qCom>
          <vUnCom>${nfe.valor.toFixed(2)}</vUnCom>
          <vProd>${nfe.valor.toFixed(2)}</vProd>
          <cEANTrib>SEM GTIN</cEANTrib>
          <uTrib>UN</uTrib>
          <qTrib>1.0000</qTrib>
          <vUnTrib>${nfe.valor.toFixed(2)}</vUnTrib>
          <indTot>1</indTot>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <orig>0</orig>
              <CST>00</CST>
              <modBC>3</modBC>
              <vBC>${nfe.valor.toFixed(2)}</vBC>
              <pICMS>${nfe.aliqICMS.toFixed(2)}</pICMS>
              <vICMS>${nfe.valorICMS.toFixed(2)}</vICMS>
            </ICMS00>
          </ICMS>
          <PIS><PISAliq><CST>01</CST><vBC>${nfe.valor.toFixed(2)}</vBC><pPIS>1.65</pPIS><vPIS>${(nfe.valor*0.0165).toFixed(2)}</vPIS></PISAliq></PIS>
          <COFINS><COFINSAliq><CST>01</CST><vBC>${nfe.valor.toFixed(2)}</vBC><pCOFINS>7.60</pCOFINS><vCOFINS>${(nfe.valor*0.076).toFixed(2)}</vCOFINS></COFINSAliq></COFINS>
        </imposto>
      </det>
      <total>
        <ICMSTot>
          <vBC>${nfe.valor.toFixed(2)}</vBC>
          <vICMS>${nfe.valorICMS.toFixed(2)}</vICMS>
          <vProd>${nfe.valor.toFixed(2)}</vProd>
          <vNF>${nfe.valor.toFixed(2)}</vNF>
        </ICMSTot>
      </total>
    </infNFe>
    <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
      <SignedInfo>
        <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
        <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
        <Reference URI="#${id}">
          <DigestValue>SIMULATION-${nfe.chave.slice(-12)}</DigestValue>
        </Reference>
      </SignedInfo>
      <SignatureValue>FAKE-SIGNATURE-FOR-SIMULATION-ONLY</SignatureValue>
      <KeyInfo><KeyName>FAKE-SIMULATION-ONLY</KeyName></KeyInfo>
    </Signature>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <tpAmb>2</tpAmb>
      <verAplic>SIMULATION-3.2</verAplic>
      <chNFe>${nfe.chave}</chNFe>
      <dhRecbto>${dhEmi}</dhRecbto>
      <nProt>135260000099${nfe.numero}</nProt>
      <digVal>SIM-${nfe.chave.slice(-8)}</digVal>
      <cStat>${nfe.status === "AUTORIZADA" ? 100 : nfe.status === "REJEITADA" ? 539 : 103}</cStat>
      <xMotivo>${nfe.status === "AUTORIZADA" ? "Autorizado o uso da NF-e (SIMULAÇÃO)" : nfe.status}</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>`;
}

/** Lightweight XML pretty token highlighter (tag, attr, value). */
export function highlightXML(xml: string): { kind: "tag" | "attr" | "value" | "text" | "comment"; text: string }[] {
  const tokens: { kind: "tag" | "attr" | "value" | "text" | "comment"; text: string }[] = [];
  const re = /(<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<\/?[^>]+>)|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[1]) {
      const tag = m[1];
      // split attributes
      const inner = tag.replace(/^<\/?|\/?>$|\?>$|^<\?/g, "");
      const parts = inner.split(/\s+/);
      tokens.push({ kind: "tag", text: tag.startsWith("<?") || tag.startsWith("<!--") ? tag.split(" ")[0] : `<${tag.startsWith("</") ? "/" : ""}${parts[0]}` });
      for (let i = 1; i < parts.length; i++) {
        const a = parts[i];
        if (a.includes("=")) {
          const [k, v] = a.split("=");
          tokens.push({ kind: "text", text: " " });
          tokens.push({ kind: "attr", text: k });
          tokens.push({ kind: "text", text: "=" });
          tokens.push({ kind: "value", text: v });
        } else if (a) {
          tokens.push({ kind: "text", text: " " + a });
        }
      }
      tokens.push({ kind: "tag", text: tag.endsWith("/>") ? "/>" : ">" });
    } else if (m[2]) {
      tokens.push({ kind: "text", text: m[2] });
    }
  }
  return tokens;
}
