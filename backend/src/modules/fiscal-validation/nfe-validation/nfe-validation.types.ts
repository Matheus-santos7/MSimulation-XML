import type { NfeMcpAudit } from "./rules/nfe-mcp-audit.js";

export type NfeValidationStatus = "PENDING" | "APPROVED" | "REJECTED";

/** Domain result of MCP validation orchestration (before Prisma mapping). */
export type NfeValidationOutcome = {
  status: NfeValidationStatus;
  message: string | null;
  errors: string[] | null;
  audit: NfeMcpAudit | null;
};
