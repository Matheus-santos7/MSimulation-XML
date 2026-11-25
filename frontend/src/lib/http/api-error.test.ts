import assert from "node:assert/strict";
import { test } from "node:test";
import { readApiErrorPayload } from "./api-error";

const json = (body: unknown, status = 400) =>
  new Response(JSON.stringify(body), { status, statusText: "Bad Request" });

test("readApiErrorPayload usa o { error } do backend e repassa details", async () => {
  const payload = await readApiErrorPayload(
    json({ error: "Produto não encontrado", details: { sku: ["Obrigatório"] } }, 404),
  );
  assert.deepEqual(payload, { error: "Produto não encontrado", details: { sku: ["Obrigatório"] } });
});

test("readApiErrorPayload aceita { message } e texto puro", async () => {
  assert.equal(
    (await readApiErrorPayload(json({ message: "Sem permissão" }, 403))).error,
    "Sem permissão",
  );
  assert.equal(
    (await readApiErrorPayload(new Response("Falhou", { status: 400 }))).error,
    "Falhou",
  );
});

test("readApiErrorPayload troca corpo vazio e erro técnico pelo fallback em português", async () => {
  const empty = await readApiErrorPayload(
    new Response("", { status: 400, statusText: "Bad Request" }),
  );
  assert.equal(empty.error, "Não foi possível completar a operação. Tente novamente em instantes.");
  const custom = await readApiErrorPayload(
    new Response("", { status: 400 }),
    "Falha na autenticação.",
  );
  assert.equal(custom.error, "Falha na autenticação.");
  const technical = await readApiErrorPayload(
    json({ error: "Invalid `prisma.user.find()` invocation in" }, 500),
  );
  assert.equal(
    technical.error,
    "Não foi possível completar a operação. Tente novamente em instantes.",
  );
  assert.equal(
    (await readApiErrorPayload(new Response("", { status: 503 }))).error,
    "Serviço temporariamente indisponível. Tente novamente em instantes.",
  );
});
