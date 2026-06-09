import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compactXmlForDownload,
  fiscalXmlDownloadFilename,
  prepareFiscalXmlForDownload,
} from "./xml-download.js";
import { injectSimulationSignature, NFE_SIGNATURE_CONFIG, verifySimulationXmlSignature } from "./xml-signature.js";

test("fiscalXmlDownloadFilename monta nome com tipo e chave", () => {
  assert.equal(
    fiscalXmlDownloadFilename("NFe", "35260112345678000199550010000000011234567890"),
    "NFe_35260112345678000199550010000000011234567890.xml",
  );
  assert.equal(fiscalXmlDownloadFilename("Canc", "chave"), "Canc_chave.xml");
});

test("prepareFiscalXmlForDownload compacta e mantém assinatura verificável", () => {
  const infNFe = `<infNFe Id="NFe35260601490698006689550090000000011792269474" versao="4.00"><ide><cUF>35</cUF></ide></infNFe>`;
  const unsigned = `<?xml version="1.0"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe>${infNFe}</NFe></nfeProc>`;
  const signed = injectSimulationSignature(unsigned, NFE_SIGNATURE_CONFIG);
  const downloaded = prepareFiscalXmlForDownload(signed);
  assert.ok(!downloaded.includes("\n"));
  assert.equal(verifySimulationXmlSignature(downloaded), true);
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
