import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FastifyRequest } from "fastify";
import { HttpError } from "../../../../lib/http/http-error.js";
import { LookupNotFoundError } from "../../domain/errors/lookup-not-found.error.js";
import { LookupValidationError } from "../../domain/errors/lookup-validation.error.js";
import type { LookupContext } from "../../lookup.tokens.js";
import { LookupController } from "./lookup.controller.js";

const VALID_CNPJ = "12345678000199";
const VALID_CEP = "01001000";

function requestWithLog(errors: unknown[]): FastifyRequest {
  return { log: { error: (value: unknown) => errors.push(value) } } as unknown as FastifyRequest;
}

function controllerThatFails(error: unknown): LookupController {
  const fail = async () => {
    throw error;
  };

  return new LookupController({
    lookupCnpj: { execute: fail },
    lookupCep: { execute: fail },
  } as unknown as LookupContext);
}

async function httpErrorOf(promise: Promise<unknown>): Promise<HttpError> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof HttpError);

    return error;
  }
  assert.fail("esperava HttpError");
}

describe("LookupController", () => {
  it("devolve o resultado do use case", async () => {
    const controller = new LookupController({
      lookupCnpj: { execute: async (cnpj: string) => ({ cnpj }) },
      lookupCep: { execute: async (cep: string) => ({ cep }) },
    } as unknown as LookupContext);

    assert.deepEqual(await controller.cnpj({ cnpj: VALID_CNPJ }, requestWithLog([])), {
      cnpj: VALID_CNPJ,
    });
    assert.deepEqual(await controller.cep({ cep: VALID_CEP }, requestWithLog([])), {
      cep: VALID_CEP,
    });
  });

  it("responde 400 com mensagem fixa quando o parâmetro é inválido", async () => {
    const controller = controllerThatFails(new Error("não deveria chamar"));

    const cnpj = await httpErrorOf(controller.cnpj({ cnpj: "1" }, requestWithLog([])));
    const cep = await httpErrorOf(controller.cep({ cep: "1" }, requestWithLog([])));

    assert.deepEqual([cnpj.status, cnpj.message], [400, "CNPJ inválido"]);
    assert.deepEqual([cep.status, cep.message], [400, "CEP inválido"]);
  });

  it("responde 404 e 400 para os erros de domínio", async () => {
    const notFound = await httpErrorOf(
      controllerThatFails(new LookupNotFoundError("CNPJ não encontrado")).cnpj(
        { cnpj: VALID_CNPJ },
        requestWithLog([]),
      ),
    );
    const invalid = await httpErrorOf(
      controllerThatFails(new LookupValidationError("CEP inválido")).cep(
        { cep: VALID_CEP },
        requestWithLog([]),
      ),
    );

    assert.deepEqual([notFound.status, notFound.message], [404, "CNPJ não encontrado"]);
    assert.deepEqual([invalid.status, invalid.message], [400, "CEP inválido"]);
  });

  it("responde 502 e registra o erro quando a API externa falha", async () => {
    const errors: unknown[] = [];
    const upstream = new Error("timeout na BrasilAPI");

    const error = await httpErrorOf(
      controllerThatFails(upstream).cnpj({ cnpj: VALID_CNPJ }, requestWithLog(errors)),
    );

    assert.deepEqual([error.status, error.message], [502, "timeout na BrasilAPI"]);
    assert.deepEqual(errors, [upstream]);
  });
});
