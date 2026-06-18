/**
 * Classe base abstrata para builders de NF-e (Strategy Pattern).
 *
 * Cada tipo de nota (`VENDA`, `REMESSA`, etc.) estende esta classe e implementa
 * as partes variáveis (`buildDet`, `buildTransp`, totais e pagamento) enquanto
 * a orquestração comum (`ide`, `emit`, `dest`, envelope `nfeProc`) permanece aqui.
 *
 * ## Strategy Pattern
 *
 * - **Contexto:** `BaseNFeBuilder` — monta o documento AST completo via `build()`.
 * - **Estratégias concretas:** `VendaNFeStrategyBuilder`, `RemessaNFeStrategyBuilder`.
 * - **Seleção:** `createNFeBuilder()` em `core/nfe-factory.ts`.
 *
 * Nenhuma string XML é concatenada nesta camada — apenas objetos serializados
 * em `buildXml()` via `core/xml-serializer`.
 *
 * @module builders/base-nfe.builder
 */

import {
  formatNfeDateTime,
  injectSimulationSignature,
  NFE_SIGNATURE_CONFIG,
} from "@msimulation-xml/fiscal-core";
import type { XmlObject } from "../core/xml-serializer.js";
import { serializeXmlDocument } from "../core/xml-serializer.js";
import type { NfeProcDocument } from "../core/nfe-ast.types.js";
import { parseEngineFromFiscalPayload } from "../fiscal-engine-xml.js";
import { resolveAutXmlCpfs } from "../fiscal/fiscal-xml.util.js";
import { REMESSA_AUT_XML_CPFS } from "../constants.js";
import { resolveEmitterFromPayload } from "../resolve-emitter.js";
import type {
  BaseNFeBuildContext,
  DetBuildResult,
  IdeBuildOptions,
  NFeBuilderInput,
  NFeBuilderResult,
} from "./builder.types.js";
import {
  buildAutXmlNodes,
  buildInfAdicNode,
  buildInfIntermedNode,
  buildProtNFeNode,
} from "./nodes/auxiliary.node.js";
import { buildDestNode } from "./nodes/dest.node.js";
import { buildEmitNode } from "./nodes/emit.node.js";
import { buildIdeNode } from "./nodes/ide.node.js";

/** Mescla filhos de `infNFe` preservando tags repetidas (`autXML`, `det`) como arrays. */
function mergeInfNFeChild(target: XmlObject, source: XmlObject): void {
  for (const [key, value] of Object.entries(source)) {
    if (value == null) continue;
    if (!(key in target)) {
      target[key] = value;
      continue;
    }
    const existing = target[key];
    if (Array.isArray(existing)) {
      if (Array.isArray(value)) {
        existing.push(...(value as XmlObject[]));
      } else if (typeof value === "object") {
        existing.push(value as XmlObject);
      }
      continue;
    }
    if (Array.isArray(value)) {
      target[key] = [existing as XmlObject, ...(value as XmlObject[])];
      continue;
    }
    if (typeof existing === "object" && typeof value === "object") {
      target[key] = [existing as XmlObject, value as XmlObject];
    }
  }
}

/**
 * Builder abstrato que orquestra nós compartilhados e delega variáveis às subclasses.
 */
export abstract class BaseNFeBuilder {
  protected readonly input: NFeBuilderInput;
  protected readonly ctx: BaseNFeBuildContext;

  constructor(input: NFeBuilderInput) {
    this.input = input;
    this.ctx = this.resolveBaseContext(input);
  }

  /** Resolve contexto compartilhado (fiscal, engine, emitter, datas). */
  protected resolveBaseContext(input: NFeBuilderInput): BaseNFeBuildContext {
    const fiscal = (input.nfe.fiscalPayload ?? {}) as Record<string, unknown>;
    return {
      nfe: input.nfe,
      emit: input.emit,
      product: input.product,
      products: input.products,
      emitterSettings: input.emitterSettings,
      fiscal,
      engine: parseEngineFromFiscalPayload(fiscal),
      emitter: resolveEmitterFromPayload(
        fiscal,
        input.emitterSettings ?? null,
        input.nfe.tipo,
        input.nfe.valor,
        input.nfe.valorICMS,
      ),
      dhEmi: formatNfeDateTime(input.nfe.emitidaEm),
      autXmlCpfs: resolveAutXmlCpfs(fiscal, REMESSA_AUT_XML_CPFS),
    };
  }

  /** Opções do grupo `<ide>` — cada estratégia define indFinal, verProc, NFref, etc. */
  protected abstract getIdeOptions(): IdeBuildOptions;

  /** Monta item(ns) `<det>` — lógica específica por tipo de nota. */
  protected abstract buildDet(): DetBuildResult;

  /** Monta bloco `<transp>`. */
  protected abstract buildTransp(): XmlObject;

  /** Monta bloco `<total>`. */
  protected abstract buildTotal(): XmlObject;

  /** Monta bloco `<pag>` ou retorna null para omitir. */
  protected abstract buildPag(): XmlObject | null;

  /** Monta `<infAdic>` ou retorna null. */
  protected abstract buildInfAdic(): XmlObject | null;

  /** Monta `<infRespTec>` ou retorna null. */
  protected abstract buildInfRespTec(): XmlObject | null;

  /** Quando true, inclui `<infIntermed>`. */
  protected abstract shouldIncludeInfIntermed(): boolean;

  /** Quando true, inclui `<IE>` no destinatário. */
  protected abstract shouldIncludeDestIe(): boolean;

  /** Monta `<ide>`. */
  protected buildIde(): XmlObject {
    const opts = this.getIdeOptions();
    return buildIdeNode({
      nfe: this.ctx.nfe,
      emitUf: opts.stockUf,
      cMunFG: this.ctx.emit.endereco.cMun,
      dhEmi: this.ctx.dhEmi,
      options: opts,
    });
  }

  /** Monta `<emit>`. */
  protected buildEmit(): XmlObject {
    return buildEmitNode(this.ctx.emit);
  }

  /** Monta `<dest>`. */
  protected buildDest(): XmlObject {
    return buildDestNode({
      destinatario: this.ctx.nfe.destinatario,
      fiscal: this.ctx.fiscal,
      includeIe: this.shouldIncludeDestIe(),
    });
  }

  /** Monta blocos `<autXML>`. */
  protected buildAutXml(): XmlObject[] {
    return buildAutXmlNodes(this.ctx.autXmlCpfs);
  }

  /**
   * Monta documento AST `nfeProc` completo.
   * Template method — ordem fixa dos nós conforme layout NF-e v4.00.
   */
  build(): NFeBuilderResult {
    const id = `NFe${this.ctx.nfe.chave}` as const;

    const infNFeChildren: XmlObject[] = [
      this.buildIde(),
      this.buildEmit(),
      this.buildDest(),
      ...this.buildAutXml(),
    ];

    const det = this.buildDet();
    if (Array.isArray(det)) {
      infNFeChildren.push(...det);
    } else {
      infNFeChildren.push(det);
    }

    infNFeChildren.push(this.buildTotal(), this.buildTransp());

    const pag = this.buildPag();
    if (pag) infNFeChildren.push(pag);

    if (this.shouldIncludeInfIntermed()) {
      infNFeChildren.push(buildInfIntermedNode(this.ctx.fiscal));
    }

    const infAdic = this.buildInfAdic();
    if (infAdic) infNFeChildren.push(infAdic);

    const infRespTec = this.buildInfRespTec();
    if (infRespTec) infNFeChildren.push(infRespTec);

    const infNFe: XmlObject = {
      "@Id": id,
      "@versao": "4.00",
    };
    for (const child of infNFeChildren) {
      mergeInfNFeChild(infNFe, child);
    }

    const protNFe = buildProtNFeNode(this.ctx.nfe, this.ctx.dhEmi).protNFe;

    const doc: NfeProcDocument = {
      declaration: { version: "1.0", encoding: "UTF-8" },
      root: {
        nfeProc: {
          "@xmlns": "http://www.portalfiscal.inf.br/nfe",
          "@versao": "4.00",
          NFe: { infNFe: infNFe as NfeProcDocument["root"]["nfeProc"]["NFe"]["infNFe"] },
          protNFe: protNFe as NfeProcDocument["root"]["nfeProc"]["protNFe"],
        },
      },
    };

    return doc;
  }

  /** Serializa o AST para string XML com assinatura de simulação. */
  buildXml(): string {
    const doc = this.build();
    const xml = serializeXmlDocument(doc);
    return injectSimulationSignature(xml, NFE_SIGNATURE_CONFIG);
  }
}
