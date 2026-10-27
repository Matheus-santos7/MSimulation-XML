import { Inject, Injectable } from "@nestjs/common";
import { AuthSettings } from "../auth.settings.js";
import {
  clearedLockoutState,
  isLoginLocked,
  lockoutMessage,
  nextLockoutState,
  type LoginLockoutState,
} from "../rules/login-lockout.rules.js";

/** Lockout progressivo de login (limite e duração vindos do `AuthSettings`). */
@Injectable()
export class LoginLockoutProvider {
  constructor(@Inject(AuthSettings) private readonly settings: AuthSettings) {}

  isLoginLocked(lockedUntil: Date | null | undefined): boolean {
    return isLoginLocked(lockedUntil);
  }

  lockoutMessage(lockedUntil: Date): string {
    return lockoutMessage(lockedUntil);
  }

  nextFailedLoginState(currentAttempts: number): LoginLockoutState {
    return nextLockoutState(
      currentAttempts,
      this.settings.loginMaxFailedAttempts,
      this.settings.loginLockoutMs,
    );
  }

  clearedState(): LoginLockoutState {
    return clearedLockoutState();
  }
}
