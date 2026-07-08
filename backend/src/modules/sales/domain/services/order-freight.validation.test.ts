import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertOrderFreightFilled,
  normalizeOrderFreight,
  sumOrderFreteCte,
} from "./order-freight.validation.js";

test("normalizeOrderFreight arredonda e zera negativos", () => {
  assert.deepEqual(normalizeOrderFreight({ freteConsumidor: 12.9, freteSeller: 0 }), {
    freteConsumidor: 12.9,
    freteSeller: 0,
  });
});

test("assertOrderFreightFilled rejeita ambos zero", () => {
  assert.throws(
    () => assertOrderFreightFilled({ freteConsumidor: 0, freteSeller: 0 }),
    /ao menos um deve ser maior que zero/,
  );
});

test("assertOrderFreightFilled aceita apenas seller", () => {
  assert.doesNotThrow(() => assertOrderFreightFilled({ freteConsumidor: 0, freteSeller: 8.5 }));
});

test("sumOrderFreteCte soma consumidor e seller", () => {
  assert.equal(
    sumOrderFreteCte({ freteConsumidor: 10, freteSeller: 5.5 }),
    15.5,
  );
});
