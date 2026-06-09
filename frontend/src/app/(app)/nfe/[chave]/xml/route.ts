import { resolveNfeCancelamentoEventoXml, resolveNfeXml } from "@/lib/resolve-nfe-xml";
import { buildXmlRouteResponse } from "@/lib/xml-download-response";

type Props = { params: Promise<{ chave: string }> };

export async function GET(req: Request, { params }: Props) {
  const { chave } = await params;
  const doc = new URL(req.url).searchParams.get("doc");
  const resolved =
    doc === "evento" || doc === "cancelamento"
      ? await resolveNfeCancelamentoEventoXml(chave)
      : await resolveNfeXml(chave);
  if (!resolved) {
    const msg =
      doc === "evento" || doc === "cancelamento"
        ? "Evento de cancelamento não encontrado para esta NF-e"
        : "NF-e não encontrada";
    return new Response(msg, { status: 404 });
  }

  const download = new URL(req.url).searchParams.get("download") === "1";
  const { body, headers } = buildXmlRouteResponse(resolved.xml, resolved.filename, download);
  return new Response(body, { headers });
}
