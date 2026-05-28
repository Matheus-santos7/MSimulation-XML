import { resolveNfeXml } from "@/lib/resolve-nfe-xml";

type Props = { params: Promise<{ chave: string }> };

export async function GET(req: Request, { params }: Props) {
  const { chave } = await params;
  const resolved = await resolveNfeXml(chave);
  if (!resolved) {
    return new Response("NF-e não encontrada", { status: 404 });
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
