/**
 * Utilitários compartilhados pelos node builders de NF-e.
 *
 * @module builders/nodes/builder.util
 */

import type { IbsCbsVBcInput } from "../../fiscal/fiscal-xml.util.js";
import type { EngineItem } from "../../fiscal-engine-xml.js";

export function asNum(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatEanForXml(ean?: string): string {
  const digits = (ean ?? "").replace(/\D/g, "");
  if (digits.length === 8 || digits.length === 12 || digits.length === 13 || digits.length === 14) {
    return digits;
  }
  return "SEM GTIN";
}

export function formatNfeQuantity(q: number): string {
  return q.toFixed(4);
}

export function idDestFromUfs(emitUf: string, destUf: string): number {
  return emitUf.toUpperCase() === destUf.toUpperCase() ? 1 : 2;
}

export function optionalText(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function ibsCbsBcInputFromEngineItem(engineItem?: EngineItem): IbsCbsVBcInput {
  return {
    vProd: engineItem?.vProd ?? 0,
    vFrete: engineItem?.vFrete ?? 0,
    vPIS: engineItem?.pis.vPIS ?? 0,
    vCOFINS: engineItem?.cofins.vCOFINS ?? 0,
    vICMS: engineItem?.icms.vICMS ?? 0,
    vFCP: engineItem?.icms.vFCP ?? 0,
    vICMSUFDest: engineItem?.difal?.vICMSUFDest ?? 0,
    vFCPUFDest: engineItem?.difal?.vFCPUFDest ?? 0,
  };
}

export function ibsCbsBcInputFromSnapshot(
  vProd: number,
  fiscal: Record<string, unknown>,
  valorIcms: number,
): IbsCbsVBcInput {
  const pis = (fiscal.pis as Record<string, unknown> | undefined) ?? {};
  const cofins = (fiscal.cofins as Record<string, unknown> | undefined) ?? {};
  const vBcPis = asNum(pis.vBc, vProd);
  const pPis = asNum(pis.aliquota, 0);
  const pCofins = asNum(cofins.aliquota, 0);
  const difal = (fiscal.difal as Record<string, unknown> | undefined) ?? {};
  const vFrete = asNum(fiscal.valorFrete, 0);
  return {
    vProd,
    vFrete,
    vPIS: Math.round(vBcPis * (pPis / 100) * 100) / 100,
    vCOFINS: Math.round(vBcPis * (pCofins / 100) * 100) / 100,
    vICMS: valorIcms,
    vICMSUFDest: asNum(difal.vICMSUFDest, 0),
    vFCPUFDest: asNum(difal.vFCPUFDest, 0),
  };
}

export function hasMlFulfillmentPayload(fiscal: Record<string, unknown>): boolean {
  return fiscal.ibsCbs != null || fiscal.autXmlCpfs != null || fiscal.infIntermed != null;
}
