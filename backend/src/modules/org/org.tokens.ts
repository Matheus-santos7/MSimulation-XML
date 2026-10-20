import type { createOrgModule } from "./infrastructure/factory/org-module.factory.js";

/** Composition root de Org (tenant, filiais e usuários), injetado nos controllers Nest. */
export const ORG = Symbol("ORG");

export type OrgContext = ReturnType<typeof createOrgModule>;
