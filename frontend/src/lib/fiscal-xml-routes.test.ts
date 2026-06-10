import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fiscalEventHasXml, fiscalEventXmlHref, fiscalXmlHref } from "./fiscal-xml-routes.js";

describe("fiscalXmlHref", () => {
  it("monta URLs de NF-e, evento, CT-e e inutilização", () => {
    assert.deepEqual(fiscalXmlHref("nfe", "chave-nfe"), {
      view: "/nfe/chave-nfe/xml",
      download: "/nfe/chave-nfe/xml?download=1",
    });
    assert.deepEqual(fiscalXmlHref("nfe-evento", "chave-nfe"), {
      view: "/nfe/chave-nfe/xml?doc=evento",
      download: "/nfe/chave-nfe/xml?doc=evento&download=1",
    });
    assert.deepEqual(fiscalXmlHref("cte", "chave-cte"), {
      view: "/cte/chave-cte/xml",
      download: "/cte/chave-cte/xml?download=1",
    });
    assert.deepEqual(fiscalXmlHref("inutilizacao", "evt-1"), {
      view: "/nfe/inutilizacao/evt-1/xml",
      download: "/nfe/inutilizacao/evt-1/xml?download=1",
    });
  });
});

describe("fiscalEventXmlHref", () => {
  it("resolve cancelamento e inutilização", () => {
    assert.deepEqual(
      fiscalEventXmlHref({ id: "e1", tipo: "110111", chaveRef: "NFE123" }),
      fiscalXmlHref("nfe-evento", "NFE123"),
    );
    assert.deepEqual(
      fiscalEventXmlHref({ id: "e2", tipo: "INUT", chaveRef: undefined }),
      fiscalXmlHref("inutilizacao", "e2"),
    );
    assert.equal(fiscalEventXmlHref({ id: "e3", tipo: "210210", chaveRef: "NFE123" }), null);
    assert.equal(fiscalEventHasXml({ tipo: "210210", chaveRef: "NFE123" }), false);
    assert.equal(fiscalEventHasXml({ tipo: "110111", chaveRef: "NFE123" }), true);
  });
});
