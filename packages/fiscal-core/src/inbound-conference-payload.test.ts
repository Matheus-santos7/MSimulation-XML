import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isInboundPositiveDifferenceNfe,
  mlProcessFromFiscalPayload,
  ML_PROCESS_INBOUND_POSITIVE_DIFFERENCE,
} from "./inbound-conference-payload.js";

describe("inbound-conference-payload", () => {
  it("reconhece filha POSITIVE pelo mlProcess", () => {
    assert.equal(
      isInboundPositiveDifferenceNfe({
        tipo: "REMESSA",
        fiscalPayload: { mlProcess: ML_PROCESS_INBOUND_POSITIVE_DIFFERENCE },
      }),
      true,
    );
  });

  it("ignora remessa referenciada sem mlProcess POSITIVE", () => {
    assert.equal(
      isInboundPositiveDifferenceNfe({
        tipo: "REMESSA",
        fiscalPayload: { engine: {} },
      }),
      false,
    );
    assert.equal(
      isInboundPositiveDifferenceNfe({
        tipo: "REMESSA",
        fiscalPayload: { mlProcess: "INBOUND" },
      }),
      false,
    );
    assert.equal(mlProcessFromFiscalPayload(null), null);
  });
});
