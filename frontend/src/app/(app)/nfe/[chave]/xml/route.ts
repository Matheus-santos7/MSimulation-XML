import { getNfeXml } from "@/lib/fiscal-api";
import { sanitizeDownloadFilename } from "@/lib/xml-download-response";

type Props = { params: Promise<{ chave: string }> };

export async function GET(req: Request, { params }: Props) {
  const { chave } = await params;
  const url = new URL(req.url);
  const docParam = url.searchParams.get("doc");
  const doc = docParam === "evento" || docParam === "cancelamento" ? "evento" : undefined;
  const download = url.searchParams.get("download") === "1";

  try {
    const { xml, filename } = await getNfeXml(chave, { download, doc });
    const headers: HeadersInit = {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store",
    };
    if (download) {
      headers["Content-Disposition"] = `attachment; filename="${sanitizeDownloadFilename(filename)}"`;
    }
    return new Response(xml, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar XML";
    const status = message.toLowerCase().includes("não encontrad") ? 404 : 502;
    return new Response(message, { status });
  }
}
