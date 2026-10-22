import type { DbClient } from "../../../../lib/db/prisma-tx.js";

/** Campos mínimos da NF-e para regenerar o XML no backfill. */
export type NfeRowForXmlResolution = {
  id: string;
  tipo: string;
  xmlAutorizado: string | null;
  nfeReferencia: { chave: string } | null;
  tenant: unknown;
  product: unknown | null;
  itens: Array<{ product: unknown } & Record<string, unknown>>;
};

/**
 * Resolve o XML da NF-e para revalidação. Implementado pelo fiscal-documents e ligado no
 * `FiscalValidationModule`, para este módulo não depender da infraestrutura de XML.
 */
export type NfeXmlContentResolver = {
  resolveXml(db: DbClient, tenantId: string, row: NfeRowForXmlResolution): Promise<string | null>;
};

export const NFE_XML_CONTENT_RESOLVER = Symbol("NFE_XML_CONTENT_RESOLVER");
