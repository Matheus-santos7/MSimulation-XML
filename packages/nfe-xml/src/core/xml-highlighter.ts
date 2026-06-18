/**
 * Tokenizador leve para realce de XML na UI.
 *
 * @module core/xml-highlighter
 */

export type XmlHighlightToken = {
  kind: "tag" | "attr" | "value" | "text" | "comment";
  text: string;
};

/** Destaca tags, atributos e valores em uma string XML. */
export function highlightXML(xml: string): XmlHighlightToken[] {
  const tokens: XmlHighlightToken[] = [];
  const re = /(<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<\/?[^>]+>)|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[1]) {
      const tag = m[1];
      const inner = tag.replace(/^<\/?|\/?>$|\?>$|^<\?/g, "");
      const parts = inner.split(/\s+/);
      tokens.push({
        kind: "tag",
        text:
          tag.startsWith("<?") || tag.startsWith("<!--")
            ? tag.split(" ")[0]!
            : `<${tag.startsWith("</") ? "/" : ""}${parts[0]}`,
      });
      for (let i = 1; i < parts.length; i++) {
        const a = parts[i];
        if (a?.includes("=")) {
          const [k, v] = a.split("=");
          tokens.push({ kind: "text", text: " " });
          tokens.push({ kind: "attr", text: k! });
          tokens.push({ kind: "text", text: "=" });
          tokens.push({ kind: "value", text: v! });
        } else if (a) {
          tokens.push({ kind: "text", text: " " + a });
        }
      }
      tokens.push({ kind: "tag", text: tag.endsWith("/>") ? "/>" : ">" });
    } else if (m[2]) {
      tokens.push({ kind: "text", text: m[2] });
    }
  }
  return tokens;
}
