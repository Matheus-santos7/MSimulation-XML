export type LoginLockoutState = {
  failedLoginAttempts: number;
  lockedUntil: Date | null;
};

export interface LoginLockoutPort {
  isLoginLocked(lockedUntil: Date | null | undefined): boolean;
  lockoutMessage(lockedUntil: Date): string;
  nextFailedLoginState(currentAttempts: number): LoginLockoutState;
  clearedState(): LoginLockoutState;
}
