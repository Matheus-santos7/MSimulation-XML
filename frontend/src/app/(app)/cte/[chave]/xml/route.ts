import { resolveCteXml } from "@/lib/resolve-cte-xml";
import { buildXmlRouteResponse } from "@/lib/xml-download-response";

type Props = { params: Promise<{ chave: string }> };

export async function GET(req: Request, { params }: Props) {
  const { chave } = await params;
  const resolved = await resolveCteXml(chave);
  if (!resolved) {
    return new Response("CT-e não encontrado", { status: 404 });
  }

  const download = new URL(req.url).searchParams.get("download") === "1";
  const { body, headers } = buildXmlRouteResponse(resolved.xml, resolved.filename, download);
  return new Response(body, { headers });
}
