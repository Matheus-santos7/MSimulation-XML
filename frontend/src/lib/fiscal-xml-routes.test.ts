import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fiscalEventHasXml, fiscalEventXmlHref, fiscalXmlHref } from "./fiscal-xml-routes.js";

describe("fiscalXmlHref", () => {
  it("monta caminhos da API para NF-e, evento, CT-e e inutilização", () => {
    assert.deepEqual(fiscalXmlHref("nfe", "chave-nfe"), {
      viewPath: "/api/nfes/chave-nfe/xml",
      downloadPath: "/api/nfes/chave-nfe/xml?download=1",
    });
    assert.deepEqual(fiscalXmlHref("nfe-evento", "chave-nfe"), {
      viewPath: "/api/nfes/chave-nfe/xml?doc=evento",
      downloadPath: "/api/nfes/chave-nfe/xml?doc=evento&download=1",
    });
    assert.deepEqual(fiscalXmlHref("cte", "chave-cte"), {
      viewPath: "/api/ctes/chave-cte/xml",
      downloadPath: "/api/ctes/chave-cte/xml?download=1",
    });
    assert.deepEqual(fiscalXmlHref("inutilizacao", "evt-1"), {
      viewPath: "/api/fiscal-events/evt-1/xml",
      downloadPath: "/api/fiscal-events/evt-1/xml?download=1",
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
