import { resolveNfeCancelamentoEventoXml, resolveNfeXml } from "@/lib/resolve-nfe-xml";

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
  const headers: HeadersInit = {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "no-store",
  };
  if (download) {
    headers["Content-Disposition"] = `attachment; filename="${resolved.filename}"`;
  }

  return new Response(resolved.xml, { headers });
}
