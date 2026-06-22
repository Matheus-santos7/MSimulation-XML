import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import type {
  NfeRowForXmlResolution,
  NfeXmlContentResolverPort,
} from "../../../fiscal-validation/domain/ports/nfe-xml-content-resolver.port.js";
import { resolveNfeXmlStringFromLoadedRow, type NfeRowForXmlResolution as LoadedRow } from "./nfe-xml-service.js";

/** Resolves NF-e XML for MCP backfill via fiscal-documents infrastructure. */
export class PrismaNfeXmlContentResolverAdapter implements NfeXmlContentResolverPort {
  async resolveXml(
    db: DbClient,
    tenantId: string,
    row: NfeRowForXmlResolution,
  ): Promise<string | null> {
    return resolveNfeXmlStringFromLoadedRow(db, tenantId, row as LoadedRow);
  }
}
