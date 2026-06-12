import { resolveAccessToken } from "@/lib/auth/session";
import { apiBase } from "@/lib/api-base";

export async function GET() {
  const token = await resolveAccessToken();
  const href = `${apiBase()}/api/products/spreadsheet/export`;
  const res = await fetch(href, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Falha ao exportar catálogo");
    return new Response(text, { status: res.status });
  }

  const buffer = await res.arrayBuffer();
  const disp = res.headers.get("Content-Disposition");
  const filename = disp?.match(/filename="([^"]+)"/)?.[1] ?? "produtos-catalogo.xlsx";

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
