import { proxyAuthenticatedGet } from "@/lib/http/bff-proxy";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const { search } = new URL(request.url);
  return proxyAuthenticatedGet(path, search);
}
