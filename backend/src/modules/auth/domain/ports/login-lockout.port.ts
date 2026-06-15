import type { LoginLockoutState } from "../services/login-lockout.service.js";

export type { LoginLockoutState };

export interface LoginLockoutPort {
  isLoginLocked(lockedUntil: Date | null | undefined): boolean;
  lockoutMessage(lockedUntil: Date): string;
  nextFailedLoginState(currentAttempts: number): LoginLockoutState;
  clearedState(): LoginLockoutState;
}
