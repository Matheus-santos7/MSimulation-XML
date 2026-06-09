import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatNfeDateTime } from "./nfe-datetime.js";

describe("formatNfeDateTime", () => {
  it("converte ISO UTC (Z) para offset -03:00 sem milissegundos", () => {
    assert.equal(formatNfeDateTime("2026-06-09T04:55:14.442Z"), "2026-06-09T01:55:14-03:00");
  });

  it("normaliza string já com offset", () => {
    assert.equal(formatNfeDateTime("2026-06-03T12:00:00-03:00"), "2026-06-03T12:00:00-03:00");
    assert.equal(formatNfeDateTime("2026-06-03T12:00:00.500-03:00"), "2026-06-03T12:00:00-03:00");
  });

  it("formata Date para horário de Brasília", () => {
    assert.equal(formatNfeDateTime(new Date("2026-06-09T04:55:14.000Z")), "2026-06-09T01:55:14-03:00");
  });
});
