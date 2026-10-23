import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { ZodError, z } from "zod";
import { resolveRouteError } from "../domain-errors.js";

class SampleStatusError extends Error {
  constructor(
    message: string,
    public readonly status: number = 422,
  ) {
    super(message);
    this.name = "SampleStatusError";
  }
}

class SampleMappedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SampleMappedError";
  }
}

describe("domain-errors", () => {
  it("resolveRouteError responde ZodError com 400 e details", () => {
    const schema = z.object({ sku: z.string().min(1) });
    let err: ZodError | undefined;
    try {
      schema.parse({});
    } catch (e) {
      err = e as ZodError;
    }

    assert.ok(err);
    const response = resolveRouteError(err, {});
    assert.equal(response?.status, 400);
    assert.ok(response && "details" in response.body);
  });

  it("resolveRouteError aplica mappings por tipo", () => {
    const response = resolveRouteError(new SampleMappedError("conflito"), {
      mappings: [{ type: SampleMappedError, status: 409 }],
    });

    assert.deepEqual(response, { status: 409, body: { error: "conflito" } });
  });

  it("resolveRouteError usa o status do erro em statusErrors", () => {
    const response = resolveRouteError(new SampleStatusError("faixa inválida", 422), {
      statusErrors: [SampleStatusError],
    });

    assert.deepEqual(response, { status: 422, body: { error: "faixa inválida" } });
  });

  it("resolveRouteError retorna null para erro desconhecido", () => {
    assert.equal(resolveRouteError(new Error("boom"), {}), null);
  });
});
