import {
  clearedLockoutState,
  isLoginLocked,
  lockoutMessage,
  nextLockoutState,
} from "../../../../lib/auth/login-lockout.js";
import type { LoginLockoutPort } from "../../domain/ports/login-lockout.port.js";

export class LoginLockoutAdapter implements LoginLockoutPort {
  isLoginLocked(lockedUntil: Date | null | undefined): boolean {
    return isLoginLocked(lockedUntil);
  }

  lockoutMessage(lockedUntil: Date): string {
    return lockoutMessage(lockedUntil);
  }

  nextFailedLoginState(currentAttempts: number) {
    return nextLockoutState(currentAttempts);
  }

  clearedState() {
    return clearedLockoutState();
  }
}
