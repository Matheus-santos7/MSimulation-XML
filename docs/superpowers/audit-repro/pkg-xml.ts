/**
 * PKG-2: injectSimulationSignature usa String.replace com string; `$'` e `$&` no texto viram
 * padrões de substituição. PKG-3: escapeXml não remove caracteres de controle proibidos em XML 1.0.
 * Usa o builder real do XML de inutilização (backend) e o fiscal-core compilado do workspace.
 */
import { createRequire } from "node:module";
import { buildProcInutNFeXML } from "../../../backend/src/modules/fiscal-documents/number-inutilization/rules/inutilizacao-xml.js";
import { serializeXmlObject, verifySimulationXmlSignature } from "../../../packages/fiscal-core/src/index.js";

const req = createRequire(new URL("../../../packages/fiscal-core/package.json", import.meta.url));
const { DOMParser } = req("@xmldom/xmldom") as typeof import("@xmldom/xmldom");

function wellFormed(xml: string): string {
  const errors: string[] = [];
  try {
    new DOMParser({ onError: (level: string, msg: string) => { if (level !== "warning") errors.push(msg); } } as never).parseFromString(xml, "text/xml");
  } catch (e) {
    errors.push((e as Error).message);
  }
  return errors.length ? `malformado (${errors[0]!.slice(0, 70)})` : "bem-formado";
}

const emit = { emitenteUf: "SP", emitenteCnpj: "11222333000181" };
let pkg2 = false;
for (const xJust of ["Numeracao pulada por erro no sistema", "Kit $' quebrado no sistema de teste", "Promo A $& B no sistema de teste"]) {
  const xml = buildProcInutNFeXML(emit, { ...emit, serie: 1, numeroIni: 10, numeroFim: 12, protocolo: "135000000000001", ocorridoEm: new Date().toISOString(), xJust });
  let sig: boolean;
  try { sig = verifySimulationXmlSignature(xml); } catch { sig = false; }
  const wf = wellFormed(xml);
  const bad = !sig || wf !== "bem-formado";
  if (bad && xJust.includes("$")) pkg2 = true;
  console.log(`xJust=${JSON.stringify(xJust)}: assinatura válida=${sig}, ${wf}, tamanho=${xml.length}`);
}

const xmlCtrl = serializeXmlObject({ prod: { xProd: "Camiseta\u0001Azul" } });
const pkg3 = wellFormed(xmlCtrl) !== "bem-formado";
console.log(`serializeXmlObject com \\u0001 em xProd: ${wellFormed(xmlCtrl)}`);
console.log(`VEREDITO PKG-2: ${pkg2 ? "Confirmado" : "Refutado"}; PKG-3: ${pkg3 ? "Confirmado" : "Refutado"}`);
