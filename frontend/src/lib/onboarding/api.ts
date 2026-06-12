import { authBearerFetch } from "@/lib/auth/api/client";
import type { AuthSessionDto } from "@/lib/auth/types";
import type { TenantInput } from "@/lib/fiscal-types";

/** Primeira empresa da conta — POST /api/auth/onboarding/tenant. */
export async function onboardingTenantApi(
  accessToken: string,
  input: TenantInput,
): Promise<AuthSessionDto> {
  return authBearerFetch<AuthSessionDto>(accessToken, "/api/auth/onboarding/tenant", {
    method: "POST",
    json: input,
  });
}
