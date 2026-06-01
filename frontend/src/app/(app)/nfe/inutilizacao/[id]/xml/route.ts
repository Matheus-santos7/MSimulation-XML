import { resolveInutilizacaoXml } from "@/lib/resolve-inutilizacao-xml";

type Props = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Props) {
  const { id } = await params;
  const resolved = await resolveInutilizacaoXml(id);
  if (!resolved) {
    return new Response("Inutilização não encontrada", { status: 404 });
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
