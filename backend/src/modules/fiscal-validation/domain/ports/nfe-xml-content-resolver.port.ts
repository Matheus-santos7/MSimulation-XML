import type { DbClient } from "../../../../lib/db/prisma-tx.js";

/** Minimal NF-e row fields required to regenerate XML for MCP backfill. */
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
 * Resolves NF-e XML string for validation backfill without coupling to fiscal-documents infra.
 * Implemented by fiscal-documents module at composition root.
 */
export interface NfeXmlContentResolverPort {
  resolveXml(db: DbClient, tenantId: string, row: NfeRowForXmlResolution): Promise<string | null>;
}
