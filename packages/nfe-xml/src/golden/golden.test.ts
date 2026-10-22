import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { buildNFeXmlFromBuilder } from "../core/nfe-factory.js";
import { goldenEmit, goldenProduct, goldenScenarios } from "./golden-scenarios.js";

/**
 * XMLs de referência: a geração tem que continuar idêntica byte a byte.
 * Regravar (depois de revisar o diff): `UPDATE_GOLDEN=1 pnpm --filter @msimulation-xml/nfe-xml test`.
 */
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../src/golden/fixtures");

/** O nProt usa o relógio (`nprot.ts`); é o único trecho que muda entre execuções. */
function normalize(xml: string): string {
  return xml.replace(/<nProt>\d+<\/nProt>/g, "<nProt>NPROT</nProt>");
}

describe("XMLs de referência (golden files)", () => {
  for (const scenario of goldenScenarios) {
    it(`${scenario.name} continua idêntico`, () => {
      const xml = normalize(
        buildNFeXmlFromBuilder({ nfe: scenario.nfe, emit: goldenEmit, product: goldenProduct }),
      );
      const path = join(FIXTURES_DIR, `${scenario.name}.xml`);

      if (process.env.UPDATE_GOLDEN === "1" || !existsSync(path)) {
        mkdirSync(FIXTURES_DIR, { recursive: true });
        writeFileSync(path, xml);
      }

      assert.equal(xml, readFileSync(path, "utf8"));
    });
  }
});
