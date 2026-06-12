import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REMESSA_CFOP_INTRASTATE,
  REMESSA_CFOP_INTERSTATE,
  resolveRemessaCfop,
} from "./remessa-dest.js";

describe("resolveRemessaCfop", () => {
  it("usa 5949 quando emitente e destinatário estão na mesma UF", () => {
    assert.equal(resolveRemessaCfop("SP", "SP"), REMESSA_CFOP_INTRASTATE);
    assert.equal(resolveRemessaCfop("sp", "SP"), REMESSA_CFOP_INTRASTATE);
  });

  it("usa 6949 quando emitente e destinatário estão em UFs diferentes", () => {
    assert.equal(resolveRemessaCfop("SP", "SC"), REMESSA_CFOP_INTERSTATE);
    assert.equal(resolveRemessaCfop("PR", "SP"), REMESSA_CFOP_INTERSTATE);
  });
});
