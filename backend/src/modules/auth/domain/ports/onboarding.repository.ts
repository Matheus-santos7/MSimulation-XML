import type { AuthUser } from "../entities/user.entity.js";

export type TenantOnboardingData = Record<string, unknown>;

export interface OnboardingRepository {
  findUserForOnboarding(userId: string): Promise<AuthUser | null>;
  createTenantAndAttachUser(userId: string, tenantData: TenantOnboardingData): Promise<void>;
}
