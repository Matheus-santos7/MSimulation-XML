import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DOMParser } from "@xmldom/xmldom";
import {
  enrichFiscalPayloadMlFulfillment,
  enrichFiscalPayloadWithXTexto,
  verifySimulationXmlSignature,
} from "@msimulation-xml/fiscal-core";
import { buildNFeXmlFromBuilder } from "./core/nfe-factory.js";
import type { EmitenteXml, NFeXmlInput, ProductXmlInput } from "./types.js";
import type { FiscalEmitterSettingsData } from "@msimulation-xml/fiscal-core";

/** Compat wrapper — testes espelham a API antiga via Factory + Serializer. */
function buildNFeXML(
  nfe: NFeXmlInput,
  emit: EmitenteXml,
  product?: ProductXmlInput,
  emitterSettings?: FiscalEmitterSettingsData | null,
  products?: ProductXmlInput[],
): string {
  return buildNFeXmlFromBuilder({ nfe, emit, product, emitterSettings, products });
}

const emit: EmitenteXml = {
  cnpj: "12345678000199",
  xNome: "Emitente Teste LTDA",
  xFant: "Emitente",
  ie: "1234567890",
  crt: 3,
  uf: "SP",
  endereco: {
    xLgr: "Rua A",
    nro: "100",
    xBairro: "Centro",
    cMun: "3550308",
    xMun: "São Paulo",
    uf: "SP",
    cep: "01001000",
    cPais: 1058,
    xPais: "Brasil",
  },
};

const baseNfe = (): NFeXmlInput => ({
  chave: "35260612345678000199550010000000011000000012",
  numero: 1,
  serie: 1,
  natOp: "Remessa para deposito temporario",
  cfop: "5949",
  ncm: "61091000",
  destinatario: {
    nome: "ML Fulfillment",
    doc: "03007331000141",
    uf: "SP",
    indIEDest: 1,
    endereco: {
      logradouro: "Av B",
      numero: "1",
      bairro: "Distrito",
      codigoMunicipio: "3550308",
      municipio: "São Paulo",
      uf: "SP",
      cep: "01001000",
      codigoPais: 1058,
      nomePais: "Brasil",
    },
  },
  valor: 100,
  valorICMS: 18,
  aliqICMS: 18,
  status: "AUTORIZADA",
  emitidaEm: "2026-06-03T12:00:00-03:00",
  pedidoML: "ORDER-1",
  quantidade: 2,
  tipo: "REMESSA",
  fiscalPayload: {
    engine: {
      itens: [
        {
          vProd: 100,
          quantidade: 2,
          valorUnitario: 50,
          icms: { cst: "00", orig: 0, vBC: 100, pICMS: 18, vICMS: 18 },
          pis: { cst: "09", vBC: 0, vPIS: 0 },
          cofins: { cst: "09", vBC: 0, vCOFINS: 0 },
          ipi: { cst: "55", cEnq: "103", vBC: 0, pIPI: 0, vIPI: 0 },
        },
      ],
      totais: {
        vBC: 100,
        vICMS: 18,
        vProd: 100,
        vIPI: 0,
        vPIS: 0,
        vCOFINS: 0,
        vNF: 100,
      },
    },
  },
});

describe("buildNFeXML — REMESSA", () => {
  it("gera nfeProc com ICMS do engine", () => {
    const xml = buildNFeXML(baseNfe(), emit);
    assert.match(xml, /<nfeProc/);
    assert.match(xml, /<vICMS>18\.00<\/vICMS>/);
    assert.match(xml, /<tpNF>1<\/tpNF>/);
  });

  it("inclui assinatura simulada com Transforms e DigestMethod no Reference", () => {
    const xml = buildNFeXML(baseNfe(), emit);
    assert.match(xml, /<Transforms>/);
    assert.match(xml, /<DigestMethod Algorithm="http:\/\/www\.w3\.org\/2000\/09\/xmldsig#sha1"\/>/);
    assert.match(xml, /<X509Data>/);
    assert.match(xml, /<X509Certificate>[^<]+<\/X509Certificate>/);
  });

  it("nProt no protNFe tem exatamente 15 dígitos", () => {
    const xml = buildNFeXML(baseNfe(), emit);
    const nProt = xml.match(/<nProt>(\d+)<\/nProt>/)?.[1];
    assert.ok(nProt);
    assert.equal(nProt.length, 15);
  });

  it("digVal no protNFe é Base64 válido", () => {
    const xml = buildNFeXML(baseNfe(), emit);
    const digVal = xml.match(/<digVal>([^<]+)<\/digVal>/)?.[1];
    assert.ok(digVal);
    assert.equal(digVal.length, 28);
    assert.match(digVal, /^[A-Za-z0-9+/]+={0,2}$/);
    assert.doesNotMatch(digVal, /-/);
  });

  it("assinatura digital XML-DSig é criptograficamente verificável", () => {
    const xml = buildNFeXML(baseNfe(), emit);
    assert.equal(verifySimulationXmlSignature(xml), true);
  });

  it("formata dhEmi/dhSaiEnt com offset -03:00 (sem sufixo Z)", () => {
    const nfe = baseNfe();
    nfe.emitidaEm = "2026-06-09T04:55:14.442Z";
    const xml = buildNFeXML(nfe, emit);
    assert.match(xml, /<dhEmi>2026-06-09T01:55:14-03:00<\/dhEmi>/);
    assert.match(xml, /<dhSaiEnt>2026-06-09T01:55:14-03:00<\/dhSaiEnt>/);
    assert.doesNotMatch(xml, /T\d{2}:\d{2}:\d{2}(\.\d+)?Z</);
  });

  it("usa PISNT/COFINSNT CST 09 do engine quando a matriz parametriza suspensão", () => {
    const xml = buildNFeXML(baseNfe(), emit);
    assert.match(xml, /<PISNT>\s*<CST>09<\/CST>\s*<\/PISNT>/);
    assert.match(xml, /<COFINSNT>\s*<CST>09<\/CST>\s*<\/COFINSNT>/);
  });

  it("usa PISOutr/COFINSOutr CST 49 do engine (matriz tributária)", () => {
    const nfe = baseNfe();
    nfe.fiscalPayload = {
      engine: {
        itens: [
          {
            vProd: 100,
            quantidade: 2,
            valorUnitario: 50,
            icms: { cst: "00", orig: 0, vBC: 100, pICMS: 18, vICMS: 18 },
            pis: { cst: "49", vBC: 100, vPIS: 0, aliquota: 0 },
            cofins: { cst: "49", vBC: 100, vCOFINS: 0, aliquota: 0 },
          },
        ],
        totais: {
          vBC: 100,
          vICMS: 18,
          vProd: 100,
          vIPI: 0,
          vPIS: 0,
          vCOFINS: 0,
          vNF: 100,
        },
      },
    };
    const xml = buildNFeXML(nfe, emit);
    assert.match(xml, /<PISOutr>\s*<CST>49<\/CST>/);
    assert.match(xml, /<COFINSOutr>\s*<CST>49<\/CST>/);
    assert.doesNotMatch(xml, /<PISNT>/);
  });

  it("fallback do snapshot fiscal usa CST da matriz quando não há engine", () => {
    const nfe = baseNfe();
    nfe.fiscalPayload = {
      pis: { st: "49 - Outras Operações de Saída", aliquota: 0 },
      cofins: { st: "49 - Outras Operações de Saída", aliquota: 0 },
    };
    const xml = buildNFeXML(nfe, emit);
    assert.match(xml, /<PISOutr>\s*<CST>49<\/CST>/);
    assert.match(xml, /<COFINSOutr>\s*<CST>49<\/CST>/);
  });

  it("usa cEnq numérico do snapshot fiscal quando engine não traz IPI", () => {
    const nfe = baseNfe();
    const engine = (nfe.fiscalPayload as { engine: { itens: Record<string, unknown>[] } }).engine;
    delete engine.itens[0]!.ipi;
    nfe.fiscalPayload = {
      ...nfe.fiscalPayload,
      ipi: { st: "55 - Saída com Suspensão", aliquota: 0, codEnq: 103 },
    };
    const xml = buildNFeXML(nfe, emit);
    assert.match(xml, /<cEnq>103<\/cEnq>/);
    assert.match(xml, /<IPINT>\s*<CST>55<\/CST>\s*<\/IPINT>/);
  });

  it("inclui CEST e EXTIPI no bloco prod da remessa quando o produto tem os campos", () => {
    const product = {
      sku: "4133250001",
      nome: "Liquidificador Portatil",
      ncm: "85094010",
      cest: "2100100",
      exTipi: "01",
      unidade: "PC",
      origem: 2,
      preco: 50,
      precoCusto: 50,
    };
    const xml = buildNFeXML(baseNfe(), emit, product);
    assert.match(xml, /<CEST>2100100<\/CEST>/);
    assert.match(xml, /<EXTIPI>01<\/EXTIPI>/);
  });

  it("alinha estrutura ML: IBSCBS, vItem, transporta, autXML e reforma nos totais", () => {
    const nfe = baseNfe();
    nfe.fiscalPayload = enrichFiscalPayloadMlFulfillment(nfe.fiscalPayload ?? {}, {
      quantidadeTotal: nfe.quantidade,
      destIe: "261755994",
    });
    const xml = buildNFeXML(nfe, emit);
    assert.match(xml, /<IBSCBS>\s*<CST>410<\/CST>\s*<cClassTrib>410999<\/cClassTrib>\s*<\/IBSCBS>/);
    assert.doesNotMatch(xml, /<gIBSCBS>/);
    assert.match(xml, /<vItem>100\.00<\/vItem>/);
    assert.match(xml, /<IBSCBSTot>\s*<vBCIBSCBS>0\.00<\/vBCIBSCBS>\s*<\/IBSCBSTot>/);
    assert.match(xml, /<vNFTot>100\.00<\/vNFTot>/);
    assert.match(xml, /<transporta>\s*<xNome>Transgoss Transporte e Logistica<\/xNome>\s*<\/transporta>/);
    assert.match(xml, /<infRespTec>/);
    assert.match(xml, /<autXML>\s*<CPF>87659808915<\/CPF>\s*<\/autXML>/);
    assert.match(xml, /<cEnq>103<\/cEnq>/);
    assert.match(xml, /<IPINT>\s*<CST>55<\/CST>\s*<\/IPINT>/);
    assert.match(
      xml,
      /<infCpl>Remessa para Deposito Temporario - Portaria CAT 31\/2019\. Inscricao Estadual do Operador Logistico: 261755994<\/infCpl>/,
    );
    assert.match(xml, /<xCpl>Nao consta<\/xCpl>/);
    assert.doesNotMatch(xml, /<vFCPUFDest>/);
    assert.doesNotMatch(xml, /<CEST>/);
  });

  it("obsCont external_id segue padrão INBOUND ML", () => {
    const xml = buildNFeXML(baseNfe(), emit);
    assert.match(
      xml,
      /<xTexto>INBOUND-inbound-ORDER-1-1-1-OLSS-279642028<\/xTexto>/,
    );
  });

  it("emite gIBSCBS/vBC e soma vBCIBSCBS quando CST exige o grupo", () => {
    const nfe = baseNfe();
    nfe.fiscalPayload = {
      ...(nfe.fiscalPayload as Record<string, unknown>),
      ibsCbs: { st: "000", cClassTrib: "000001" },
    };
    const xml = buildNFeXML(nfe, emit);
    assert.match(xml, /<gIBSCBS>\s*<vBC>82\.00<\/vBC>\s*<\/gIBSCBS>/);
    assert.match(xml, /<IBSCBSTot>\s*<vBCIBSCBS>82\.00<\/vBCIBSCBS>\s*<\/IBSCBSTot>/);
  });

  it("RETORNO_SIMBOLICO gera XML válido com infCpl de retorno e assinatura", () => {
    const nfe = {
      ...baseNfe(),
      numero: 2,
      tipo: "RETORNO_SIMBOLICO" as const,
      natOp: "Outras Entradas - Retorno Simbolico de Deposito Temporario",
      cfop: "2949",
      nfeReferenciaChave: baseNfe().chave,
      valor: 609,
      valorICMS: 73.08,
      aliqICMS: 12,
      quantidade: 1,
      pedidoML: "ML-781050649173",
      destinatario: {
        nome: "EBAZAR.COM.BR LTDA",
        doc: "03007331012077",
        uf: "SC",
        indIEDest: 1,
        endereco: {
          logradouro: "Av. Papenborg",
          numero: "S/N",
          complemento: "Nao consta",
          bairro: "Guaporanga",
          codigoMunicipio: "4206009",
          municipio: "Governador Celso Ramos",
          uf: "SC",
          cep: "88195900",
          codigoPais: 1058,
          nomePais: "Brasil",
        },
      },
      fiscalPayload: {
        engine: {
          itens: [
            {
              vProd: 609,
              quantidade: 1,
              valorUnitario: 609,
              icms: { cst: "90", orig: 2, vBC: 0, pICMS: 0, vICMS: 0 },
              pis: { cst: "98", vBC: 0, vPIS: 0 },
              cofins: { cst: "98", vBC: 0, vCOFINS: 0 },
              ipi: { cst: "05", cEnq: "103", vBC: 0, pIPI: 0, vIPI: 0 },
            },
          ],
          totais: {
            vBC: 0,
            vICMS: 0,
            vProd: 609,
            vIPI: 0,
            vPIS: 0,
            vCOFINS: 0,
            vNF: 609,
          },
        },
        obsContXTexto: "SALE-symbolic_inbound_return-ML-781050649173-1-OLSS-279642028",
        destIe: "261755994",
        ibsCbs: { st: "410", cClassTrib: "410999" },
        autXmlCpfs: ["87659808915", "72556455772"],
        infIntermed: { cnpj: "03007331000141", idCadIntTran: "279642028" },
      },
    };
    const product = {
      sku: "4133250001",
      nome: "Liquidificador Portatil",
      ncm: "85094010",
      cest: "2100100",
      exTipi: "01",
      unidade: "PC",
      origem: 2,
      preco: 999,
      precoCusto: 609,
    };
    const xml = buildNFeXML(nfe, { ...emit, uf: "PR", endereco: { ...emit.endereco, uf: "PR" } }, product);
    assert.match(xml, /<vUnCom>609\.00000000<\/vUnCom>/);
    assert.match(xml, /<vProd>609\.00<\/vProd>/);
    assert.match(xml, /<vItem>609\.00<\/vItem>/);
    assert.match(xml, /<tpNF>0<\/tpNF>/);
    assert.match(xml, /<idDest>2<\/idDest>/);
    assert.match(xml, /<modFrete>9<\/modFrete>/);
    assert.match(xml, /Retorno Simbolico de Deposito Temporario\./);
    assert.doesNotMatch(xml, /Portaria CAT 31\/2019/);
    assert.doesNotMatch(xml, /Remessa para Deposito Temporario/);
    assert.match(xml, /<NFref>\s*<refNFe>/);
    assert.match(xml, /<infRespTec>/);
    assert.match(xml, /<EXTIPI>/);
    assert.match(xml, /<IPINT>\s*<CST>05<\/CST>\s*<\/IPINT>/);
    assert.match(xml, /<PISOutr>\s*<CST>98<\/CST>/);
    assert.match(xml, /<COFINSOutr>\s*<CST>98<\/CST>/);
    assert.doesNotMatch(xml, /<PISNT>/);
    assert.doesNotMatch(xml, /<vol>/);
    assert.doesNotMatch(xml, /<vFCPUFDest>/);
    assert.doesNotMatch(xml, /<IPINT>\s*<CST>55<\/CST>/);

    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const err = doc.getElementsByTagName("parsererror");
    assert.equal(err.length, 0, err[0]?.textContent ?? "XML malformado");
    assert.equal(verifySimulationXmlSignature(xml), true);
  });

  it("REMESSA_SIMBOLICA pós-devolução emite infCpl CAT 31 e xTexto SALE_RETURN", () => {
    const pedidoMl = "47238016772";
    const nfe = {
      ...baseNfe(),
      serie: 2,
      pedidoML: pedidoMl,
      tipo: "REMESSA_SIMBOLICA" as const,
      nfeReferenciaChave: "35260612345678000199550010000000021000000023",
      emitidaEm: "2026-06-17T12:00:00-03:00",
      fiscalPayload: enrichFiscalPayloadMlFulfillment(
        enrichFiscalPayloadWithXTexto(
          {
            remessaSimbolicaPosDevolucao: {
              numero: 628,
              serie: 2,
              emitidaEm: "2026-06-17T12:00:00-03:00",
            },
            destIe: "241174886113",
            engine: baseNfe().fiscalPayload?.engine,
          },
          {
            tipo: "REMESSA_SIMBOLICA",
            cfop: "5949",
            natOp: "Outras Saidas - Remessa para Deposito Temporario",
            pedidoMl,
            posDevolucao: true,
            serie: 2,
            warehouseId: "3272442934",
          },
        ),
        {
          quantidadeTotal: 2,
          destIe: "241174886113",
          idCadIntTran: "3272442934",
        },
      ),
    };
    const xml = buildNFeXML(nfe, emit);
    assert.match(
      xml,
      /<infCpl>Remessa Simbolica para Deposito Temporario - Portaria CAT 31\/2019\. Inscricao Estadual do Operador Logistico: 241174886113\. Nota fiscal de devolucao n 628 emitida em 17\/06\/2026 serie 2\.<\/infCpl>/,
    );
    assert.match(
      xml,
      /<xTexto>SALE_RETURN-symbolic_inbound-47238016772-2-OLSS-3272442934<\/xTexto>/,
    );
  });

  it("REMESSA_SIMBOLICA usa CST da planilha em PIS/COFINS (não força 99)", () => {
    const nfe = {
      ...baseNfe(),
      tipo: "REMESSA_SIMBOLICA" as const,
      nfeReferenciaChave: "35260612345678000199550010000000021000000023",
      fiscalPayload: {
        engine: {
          itens: [
            {
              vProd: 100,
              quantidade: 1,
              valorUnitario: 100,
              icms: { cst: "00", orig: 0, vBC: 100, pICMS: 18, vICMS: 18 },
              pis: { cst: "49", vBC: 100, vPIS: 0, aliquota: 0 },
              cofins: { cst: "49", vBC: 100, vCOFINS: 0, aliquota: 0 },
            },
          ],
          totais: {
            vBC: 100,
            vICMS: 18,
            vProd: 100,
            vIPI: 0,
            vPIS: 0,
            vCOFINS: 0,
            vNF: 100,
          },
        },
      },
    };
    const xml = buildNFeXML(nfe, emit);
    assert.match(xml, /<PISOutr>\s*<CST>49<\/CST>/);
    assert.match(xml, /<COFINSOutr>\s*<CST>49<\/CST>/);
    assert.doesNotMatch(xml, /<PISOutr>\s*<CST>99<\/CST>/);
    assert.doesNotMatch(xml, /<COFINSOutr>\s*<CST>99<\/CST>/);
    assert.match(xml, /<NFref>\s*<refNFe>/);
  });

  it("RETORNO_SIMBOLICO usa CST 98 da planilha em PISOutr/COFINSOutr", () => {
    const nfe = {
      ...baseNfe(),
      tipo: "RETORNO_SIMBOLICO" as const,
      cfop: "2949",
      nfeReferenciaChave: baseNfe().chave,
      fiscalPayload: {
        engine: {
          itens: [
            {
              vProd: 100,
              quantidade: 1,
              valorUnitario: 100,
              icms: { cst: "90", orig: 0, vBC: 0, pICMS: 0, vICMS: 0 },
              pis: { cst: "98", vBC: 0, vPIS: 0, aliquota: 0 },
              cofins: { cst: "98", vBC: 0, vCOFINS: 0, aliquota: 0 },
              ipi: { cst: "55", cEnq: "103", vBC: 0, pIPI: 0, vIPI: 0 },
            },
          ],
          totais: {
            vBC: 0,
            vICMS: 0,
            vProd: 100,
            vIPI: 0,
            vPIS: 0,
            vCOFINS: 0,
            vNF: 100,
          },
        },
      },
    };
    const xml = buildNFeXML(nfe, emit);
    assert.match(xml, /<PISOutr>\s*<CST>98<\/CST>/);
    assert.match(xml, /<COFINSOutr>\s*<CST>98<\/CST>/);
    assert.doesNotMatch(xml, /<PISNT>/);
  });

  it("usa idCadIntTran e pesos do fiscalPayload enriquecido (emissão real)", () => {
    const nfe = baseNfe();
    nfe.fiscalPayload = enrichFiscalPayloadMlFulfillment(
      enrichFiscalPayloadWithXTexto(nfe.fiscalPayload ?? {}, {
        tipo: "REMESSA",
        cfop: nfe.cfop,
        natOp: nfe.natOp,
        pedidoMl: nfe.pedidoML,
      }),
      {
        quantidadeTotal: 2,
        idCadIntTran: "3272442934",
        destIe: "241174886113",
      },
    );
    const xml = buildNFeXML(nfe, emit);
    assert.match(xml, /<idCadIntTran>3272442934<\/idCadIntTran>/);
    assert.match(xml, /OLSS-3272442934<\/xTexto>/);
    assert.match(xml, /<qVol>2<\/qVol>/);
    assert.match(xml, /<pesoL>1\.400<\/pesoL>/);
    assert.match(xml, /<pesoB>1\.420<\/pesoB>/);
  });

  it("inclui nFCI no produto da remessa quando cadastrado", () => {
    const nfe = baseNfe();
    nfe.fiscalPayload = enrichFiscalPayloadMlFulfillment(nfe.fiscalPayload ?? {}, {
      quantidadeTotal: nfe.quantidade,
    });
    const product = {
      sku: "300002137",
      nome: "Fogao Teste",
      ncm: "73211100",
      cest: "2100100",
      exTipi: "01",
      unidade: "UNID",
      origem: 5,
      preco: 653.4,
      precoCusto: 653.4,
      nfci: "A7B816FF-59CC-41D9-97C1-B39BCED07B17",
    };
    const xml = buildNFeXML(nfe, emit, product);
    assert.match(xml, /<nFCI>A7B816FF-59CC-41D9-97C1-B39BCED07B17<\/nFCI>/);
  });
});
