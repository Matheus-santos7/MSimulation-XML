import type { TenantOnboardingData } from "../../domain/ports/onboarding.repository.js";

export type AttachTenantOnboardingCommand = {
  userId: string;
  tenantData: TenantOnboardingData;
};
