import type { LoginLockoutState } from "./login-lockout.port.js";
import type { AuthUser, AuthUserWithTenant } from "../entities/user.entity.js";

export type CreateUserData = {
  email: string;
  name?: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
};

export interface UserRepository {
  findByEmail(email: string): Promise<AuthUserWithTenant | null>;
  findById(userId: string): Promise<AuthUserWithTenant | null>;
  findAuthUserById(userId: string): Promise<AuthUser | null>;
  findTotpStatus(userId: string): Promise<{ totpEnabledAt: Date | null } | null>;
  existsByEmail(email: string): Promise<boolean>;
  createUser(data: CreateUserData): Promise<AuthUser>;
  updateLoginLockout(userId: string, state: LoginLockoutState): Promise<void>;
  clearLoginLockout(userId: string): Promise<void>;
  incrementTokenVersion(userId: string): Promise<void>;
  updatePasswordAndClearLockout(userId: string, passwordHash: string): Promise<void>;
  saveTotpSecret(userId: string, secretEnc: string): Promise<void>;
  enableTotp(userId: string): Promise<void>;
  disableTotp(userId: string): Promise<void>;
}
