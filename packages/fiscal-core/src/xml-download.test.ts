import assert from "node:assert/strict";
import { test } from "node:test";
import { compactXmlForDownload, fiscalXmlDownloadFilename } from "./xml-download.js";

test("fiscalXmlDownloadFilename monta nome com tipo e chave", () => {
  assert.equal(
    fiscalXmlDownloadFilename("NFe", "35260112345678000199550010000000011234567890"),
    "NFe_35260112345678000199550010000000011234567890.xml",
  );
  assert.equal(fiscalXmlDownloadFilename("Canc", "chave"), "Canc_chave.xml");
});

test("compactXmlForDownload colapsa XML em uma linha sem alterar conteúdo das tags", () => {
  const input = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <tag>conteudo</tag>
  <tag2>conteudo2</tag2>
</root>`;
  assert.equal(
    compactXmlForDownload(input),
    '<?xml version="1.0" encoding="UTF-8"?><root><tag>conteudo</tag><tag2>conteudo2</tag2></root>',
  );
});
