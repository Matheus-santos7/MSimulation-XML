import { describe, expect, it } from "vitest";
import { Reflector } from "@nestjs/core";
import { TaxRuleController } from "../tax-rule.controller.js";

/** Mesma chave de `src/nest/http/rate-limit.interceptor.ts` (não exportada lá). */
const RATE_LIMIT_METADATA = "api:rate-limit";

describe("TaxRuleController", () => {
  it("importSpreadsheet tem limite próprio de 10 requisições por minuto, com 403 ao estourar", () => {
    // Act
    const policy = new Reflector().get(
      RATE_LIMIT_METADATA,
      TaxRuleController.prototype.importSpreadsheet,
    );

    // Assert
    expect(policy).toEqual({ max: 10, timeWindow: "1 minute", ban: 0 });
  });
});
