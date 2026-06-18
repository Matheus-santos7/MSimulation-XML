import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  XmlSerializer,
  escapeXml,
  serializeXmlDocument,
  serializeXmlObject,
  type XmlDocument,
} from "./xml-serializer.js";

describe("escapeXml", () => {
  it("escapa caracteres reservados", () => {
    assert.equal(escapeXml(`a & b < c > d "e" 'f'`), `a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;`);
  });
});

describe("XmlSerializer", () => {
  const serializer = new XmlSerializer();

  it("serializa elemento folha com texto primitivo", () => {
    const xml = serializer.serializeRoot({ natOp: { "#text": "Venda" } });
    assert.equal(xml, "<natOp>Venda</natOp>");
  });

  it("serializa atributos com prefixo @", () => {
    const xml = serializer.serializeRoot({
      infNFe: {
        "@Id": "NFe41260678242849000169550050000000051423282896",
        "@versao": "4.00",
        ide: { cUF: 41 },
      },
    });

    assert.match(xml, /<infNFe Id="NFe41260678242849000169550050000000051423282896" versao="4\.00">/);
    assert.match(xml, /<cUF>41<\/cUF>/);
  });

  it("repete tags para arrays", () => {
    const xml = serializer.serializeRoot({
      root: {
        det: [
          { "@nItem": "1", prod: { xProd: "Item A" } },
          { "@nItem": "2", prod: { xProd: "Item B" } },
        ],
      },
    });

    assert.equal((xml.match(/<det /g) ?? []).length, 2);
    assert.match(xml, /nItem="1"/);
    assert.match(xml, /nItem="2"/);
  });

  it("serializa elemento vazio como self-closing", () => {
    const xml = serializer.serializeRoot({ empty: { "@versao": "4.00" } });
    assert.equal(xml, '<empty versao="4.00"/>');
  });

  it("escapa conteúdo textual e atributos", () => {
    const xml = serializer.serializeRoot({
      obs: {
        "@xCampo": "alerta",
        "#text": `Tom & Jerry <3>`,
      },
    });

    assert.match(xml, /xCampo="alerta"/);
    assert.match(xml, /<obs[^>]*>Tom &amp; Jerry &lt;3&gt;<\/obs>/);
  });

  it("inclui declaração XML quando informada", () => {
    const doc: XmlDocument = {
      declaration: { version: "1.0", encoding: "UTF-8" },
      root: { nfeProc: { "@versao": "4.00", NFe: { infNFe: { ide: { cUF: 35 } } } } },
    };

    const xml = serializer.serializeDocument(doc);
    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    assert.match(xml, /<nfeProc versao="4\.00">/);
  });

  it("formata nfeProc mínimo com indentação", () => {
    const doc: XmlDocument = {
      declaration: { version: "1.0", encoding: "UTF-8" },
      root: {
        nfeProc: {
          "@xmlns": "http://www.portalfiscal.inf.br/nfe",
          "@versao": "4.00",
          NFe: {
            infNFe: {
              "@Id": "NFe123",
              "@versao": "4.00",
              ide: { cUF: 41, natOp: "Venda" },
            },
          },
          protNFe: {
            "@versao": "4.00",
            infProt: { cStat: 100, xMotivo: "Autorizado" },
          },
        },
      },
    };

    const xml = serializeXmlDocument(doc);
    assert.match(xml, /xmlns="http:\/\/www\.portalfiscal\.inf\.br\/nfe"/);
    assert.match(xml, /\n<nfeProc xmlns=/);
    assert.match(xml, /\n  <NFe>/);
    assert.match(xml, /<natOp>Venda<\/natOp>/);
  });

  it("serializeXmlObject é atalho sem declaração", () => {
    const xml = serializeXmlObject({ tag: { child: "ok" } });
    assert.equal(xml.includes("<?xml"), false);
    assert.match(xml, /<child>ok<\/child>/);
  });

  it("lança erro quando root está vazio", () => {
    assert.throws(() => serializer.serializeDocument({ root: {} }), /exactly one root element/);
  });
});
