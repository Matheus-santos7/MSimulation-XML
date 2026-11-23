import { apiUrl } from "@/lib/api-base";
import { resolveAccessToken } from "@/lib/auth/session";
import { toUserFacingError } from "@/lib/user-facing-error";
import { readApiErrorMessage } from "@/lib/http/api-error";
import { assertAllowedBffPath } from "@/lib/http/bff-path";

/** Proxy autenticado para o backend Fastify (server-only). */
export async function proxyAuthenticatedGet(
  pathSegments: string[],
  search: string,
): Promise<Response> {
  const relativePath = pathSegments.join("/");
  assertAllowedBffPath(relativePath);

  const token = await resolveAccessToken();
  if (!token) {
    return Response.json(
      { error: toUserFacingError("Sessão expirada. Entre novamente.", { status: 401 }) },
      { status: 401 },
    );
  }

  const backendPath = `/api/${relativePath}${search}`;
  const upstream = await fetch(apiUrl(backendPath), {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!upstream.ok) {
    const error = await readApiErrorMessage(upstream);
    return Response.json({ error }, { status: upstream.status });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("Content-Type");
  const contentDisposition = upstream.headers.get("Content-Disposition");
  const cacheControl = upstream.headers.get("Cache-Control");
  const xmlSource = upstream.headers.get("X-NFe-Xml-Source");

  if (contentType) headers.set("Content-Type", contentType);
  if (contentDisposition) headers.set("Content-Disposition", contentDisposition);
  if (cacheControl) headers.set("Cache-Control", cacheControl);
  if (xmlSource) headers.set("X-NFe-Xml-Source", xmlSource);

  return new Response(upstream.body, { status: upstream.status, headers });
}
