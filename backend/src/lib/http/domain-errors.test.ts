import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZodError, z } from "zod";
import { handleRouteError, replyStatusDomainError } from "./domain-errors.js";

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

function mockReply() {
  let statusCode = 0;
  let body: unknown;
  const reply = {
    status(code: number) {
      statusCode = code;
      return {
        send(payload: unknown) {
          body = payload;
        },
      };
    },
  };
  return {
    reply,
    getSent() {
      return { statusCode, body };
    },
  };
}

describe("domain-errors", () => {
  it("handleRouteError responde ZodError com 400 e details", () => {
    const { reply, getSent } = mockReply();
    const schema = z.object({ sku: z.string().min(1) });
    let err: ZodError | undefined;
    try {
      schema.parse({});
    } catch (e) {
      err = e as ZodError;
    }

    assert.ok(err);
    assert.equal(handleRouteError(reply as never, err, {}), true);
    const sent = getSent();
    assert.equal(sent.statusCode, 400);
    assert.ok(sent.body && typeof sent.body === "object" && "details" in sent.body);
  });

  it("handleRouteError aplica mappings por tipo", () => {
    const { reply, getSent } = mockReply();
    const handled = handleRouteError(reply as never, new SampleMappedError("conflito"), {
      mappings: [{ type: SampleMappedError, status: 409 }],
    });

    assert.equal(handled, true);
    const sent = getSent();
    assert.equal(sent.statusCode, 409);
    assert.deepEqual(sent.body, { error: "conflito" });
  });

  it("replyStatusDomainError usa status do erro", () => {
    const { reply, getSent } = mockReply();
    const handled = replyStatusDomainError(reply as never, new SampleStatusError("faixa inválida", 422), [
      SampleStatusError,
    ]);

    assert.equal(handled, true);
    const sent = getSent();
    assert.equal(sent.statusCode, 422);
    assert.deepEqual(sent.body, { error: "faixa inválida" });
  });

  it("handleRouteError retorna false para erro desconhecido", () => {
    const { reply } = mockReply();
    assert.equal(handleRouteError(reply as never, new Error("boom"), {}), false);
  });
});
