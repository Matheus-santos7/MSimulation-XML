/**
 * Serializador objeto → XML compartilhado (`fiscal-core` + `nfe-xml`).
 *
 * Única etapa em que a árvore de objetos vira string XML (regra 04-refactory-xml).
 *
 * ## Convenções
 *
 * - **Atributos:** chaves com prefixo `@` (ex.: `{ "@Id": "NFe...", "@versao": "4.00" }`).
 * - **Arrays:** repetem a mesma tag (ex.: `{ det: [item1, item2] }` → dois `<det>`).
 * - **Texto:** chave `#text` para conteúdo textual do elemento (folha ou misto com filhos).
 * - **Primitivos:** `string | number | boolean` em folhas viram texto escapado do elemento.
 *
 * @module xml-serializer
 */

/** Valor escalar permitido em nós folha ou em `#text`. */
export type XmlPrimitive = string | number | boolean;

/** Objeto que representa um elemento XML e seus filhos/atributos. */
export type XmlObject = {
  [tag: string]: XmlNodeValue;
};

/** Valor de nó folha, array (tags repetidas) ou objeto aninhado. */
export type XmlNodeValue = XmlPrimitive | XmlObject | XmlObject[] | null | undefined;

/** Documento XML com declaração opcional e um único elemento raiz. */
export type XmlDocument = {
  declaration?: { version: string; encoding: string };
  root: XmlObject;
};

/** Opções do serializador. */
export type XmlSerializerOptions = {
  /** Indentação por nível (padrão: dois espaços). */
  indent?: string;
  /** Incluir quebras de linha entre elementos (padrão: `true`). */
  pretty?: boolean;
};

const ATTR_PREFIX = "@";
const TEXT_NODE_KEY = "#text";

/**
 * Escapa caracteres reservados em conteúdo textual e valores de atributo.
 * Cobre `&`, `<`, `>`, `"` e `'`.
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isXmlObject(value: XmlNodeValue): value is XmlObject {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function primitiveToText(value: XmlPrimitive): string {
  return typeof value === "string" ? escapeXml(value) : String(value);
}

function splitNode(node: XmlObject): {
  attrs: string;
  text: XmlPrimitive | undefined;
  children: XmlObject;
} {
  const attrs: string[] = [];
  const children: XmlObject = {};
  let text: XmlPrimitive | undefined;

  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith(ATTR_PREFIX)) {
      const attrName = key.slice(ATTR_PREFIX.length);
      if (value != null && typeof value !== "object") {
        attrs.push(`${attrName}="${escapeXml(String(value))}"`);
      }
      continue;
    }

    if (key === TEXT_NODE_KEY) {
      if (value != null && typeof value !== "object") {
        text = value as XmlPrimitive;
      }
      continue;
    }

    children[key] = value;
  }

  const attrString = attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
  return { attrs: attrString, text, children };
}

/**
 * Converte árvore de objetos em string XML formatada.
 */
export class XmlSerializer {
  private readonly indentUnit: string;
  private readonly pretty: boolean;

  constructor(options: XmlSerializerOptions = {}) {
    this.indentUnit = options.indent ?? "  ";
    this.pretty = options.pretty ?? true;
  }

  /** Serializa um documento com elemento raiz único. */
  serializeDocument(doc: XmlDocument): string {
    const [rootTag, rootValue] = Object.entries(doc.root)[0] ?? [];
    if (!rootTag || rootValue == null) {
      throw new Error("XmlDocument.root must contain exactly one root element");
    }

    const body = this.serializeElement(rootTag, rootValue, 0);
    const declaration = doc.declaration
      ? `<?xml version="${doc.declaration.version}" encoding="${doc.declaration.encoding}"?>`
      : "";

    if (!declaration) return body;
    return this.pretty ? `${declaration}\n${body}` : `${declaration}${body}`;
  }

  /** Serializa um objeto raiz `{ tagName: value }` sem declaração XML. */
  serializeRoot(root: XmlObject): string {
    const [rootTag, rootValue] = Object.entries(root)[0] ?? [];
    if (!rootTag || rootValue == null) {
      throw new Error("Root object must contain exactly one top-level element");
    }
    return this.serializeElement(rootTag, rootValue, 0);
  }

  private serializeElement(tag: string, value: XmlNodeValue, depth: number): string {
    const pad = this.pretty ? this.indentUnit.repeat(depth) : "";
    const nl = this.pretty ? "\n" : "";

    if (value == null) return "";

    if (Array.isArray(value)) {
      return value
        .map((item) => this.serializeElement(tag, item, depth))
        .filter(Boolean)
        .join(nl);
    }

    if (!isXmlObject(value)) {
      return `${pad}<${tag}>${primitiveToText(value)}</${tag}>`;
    }

    const { attrs, text, children } = splitNode(value);
    const childEntries = Object.entries(children).filter(([, child]) => child != null);

    if (childEntries.length === 0 && text == null) {
      return `${pad}<${tag}${attrs}/>`;
    }

    if (childEntries.length === 0 && text != null) {
      return `${pad}<${tag}${attrs}>${primitiveToText(text)}</${tag}>`;
    }

    const childXml = childEntries
      .flatMap(([childTag, childValue]) => {
        if (Array.isArray(childValue)) {
          return childValue.map((item) => this.serializeElement(childTag, item, depth + 1));
        }
        return [this.serializeElement(childTag, childValue, depth + 1)];
      })
      .filter(Boolean)
      .join(nl);

    const textPart = text != null ? primitiveToText(text) : "";
    const inner = textPart ? (childXml ? `${textPart}${nl}${childXml}` : textPart) : childXml;

    return `${pad}<${tag}${attrs}>${nl}${inner}${nl}${pad}</${tag}>`;
  }
}

/** Instância padrão com indentação de 2 espaços. */
const defaultSerializer = new XmlSerializer();

/** Atalho funcional para `XmlSerializer.serializeDocument`. */
export function serializeXmlDocument(doc: XmlDocument): string {
  return defaultSerializer.serializeDocument(doc);
}

/** Serializa objeto raiz sem declaração XML. */
export function serializeXmlObject(root: XmlObject): string {
  return defaultSerializer.serializeRoot(root);
}
