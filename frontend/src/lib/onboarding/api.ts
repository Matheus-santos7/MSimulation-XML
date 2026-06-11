import { AuthApiError, authApiUrl } from "@/lib/auth/api/client";
import type { AuthSessionDto } from "@/lib/auth/types";
import type { TenantInput } from "@/lib/fiscal-types";

/**
 * Primeira empresa da conta — POST /api/auth/onboarding/tenant.
 * Separado de lib/auth para não acoplar login a tipos de domínio fiscal.
 */
export async function onboardingTenantApi(
  accessToken: string,
  input: TenantInput,
): Promise<AuthSessionDto> {
  let res: Response;
  try {
    res = await fetch(authApiUrl("/api/auth/onboarding/tenant"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });
  } catch {
    throw new Error("API indisponível. Verifique se o backend está rodando.");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let error = "Erro ao cadastrar empresa";
    let details: Record<string, string[]> | undefined;
    try {
      const parsed = JSON.parse(text) as { error?: string; details?: Record<string, string[]> };
      error = parsed.error ?? error;
      details = parsed.details;
    } catch {
      if (text) error = text;
    }
    if (details) throw new AuthApiError(error, details);
    throw new Error(error);
  }
  return res.json() as Promise<AuthSessionDto>;
}
