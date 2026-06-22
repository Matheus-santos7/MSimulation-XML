import type { NfeMcpAudit } from "./nfe-mcp-audit.entity.js";

export type NfeValidationStatus = "PENDING" | "APPROVED" | "REJECTED";

/** Domain result of MCP validation orchestration (before Prisma mapping). */
export type NfeValidationOutcome = {
  status: NfeValidationStatus;
  message: string | null;
  errors: string[] | null;
  audit: NfeMcpAudit | null;
};
