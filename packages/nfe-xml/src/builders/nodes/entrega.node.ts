/**
 * `<entrega>` — Local de Entrega (operador logístico / fulfillment).
 * CAT 31: mercadoria devolvida retorna fisicamente ao CD do OL.
 *
 * @module builders/nodes/entrega.node
 */

import type { XmlObject } from "../../core/xml-serializer.js";
import { digitsOnly } from "./builder.util.js";

export type EntregaFiscalPayload = {
  CNPJ?: string;
  xNome?: string;
  xLgr?: string;
  nro?: string;
  xCpl?: string;
  xBairro?: string;
  cMun?: string;
  xMun?: string;
  UF?: string;
  CEP?: string;
  cPais?: string | number;
  xPais?: string;
  fone?: string;
};

/** Monta `<entrega>` a partir de `fiscalPayload.entrega`. */
export function buildEntregaNode(fiscal: Record<string, unknown>): XmlObject | null {
  const raw = fiscal.entrega;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const e = raw as EntregaFiscalPayload;
  const cnpj = digitsOnly(e.CNPJ ?? "");
  if (cnpj.length !== 14) return null;
  if (!e.xLgr?.trim() || !e.cMun?.trim() || !e.UF?.trim()) return null;

  const ender: XmlObject = {
    xLgr: String(e.xLgr).trim(),
    nro: String(e.nro ?? "S/N").trim() || "S/N",
    xBairro: String(e.xBairro ?? "S/N").trim() || "S/N",
    cMun: String(e.cMun).trim(),
    xMun: String(e.xMun ?? "").trim() || String(e.cMun).trim(),
    UF: String(e.UF).trim().toUpperCase(),
  };
  if (e.xCpl?.trim()) ender.xCpl = e.xCpl.trim();
  if (e.CEP) ender.CEP = digitsOnly(e.CEP).padStart(8, "0").slice(0, 8);
  if (e.cPais != null) ender.cPais = String(e.cPais);
  if (e.xPais?.trim()) ender.xPais = e.xPais.trim();
  if (e.fone) ender.fone = digitsOnly(e.fone);

  const entrega: XmlObject = { CNPJ: cnpj, ...ender };
  if (e.xNome?.trim()) entrega.xNome = e.xNome.trim();

  return { entrega };
}
