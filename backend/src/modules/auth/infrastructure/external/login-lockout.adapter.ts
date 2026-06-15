import { loginLockoutMs, loginMaxFailedAttempts } from "../../../../lib/auth/config.js";
import {
  clearedLockoutState,
  isLoginLocked,
  lockoutMessage,
  nextLockoutState,
} from "../../domain/services/login-lockout.service.js";
import type { LoginLockoutPort } from "../../domain/ports/login-lockout.port.js";

export class LoginLockoutAdapter implements LoginLockoutPort {
  isLoginLocked(lockedUntil: Date | null | undefined): boolean {
    return isLoginLocked(lockedUntil);
  }

  lockoutMessage(lockedUntil: Date): string {
    return lockoutMessage(lockedUntil);
  }

  nextFailedLoginState(currentAttempts: number) {
    return nextLockoutState(currentAttempts, loginMaxFailedAttempts(), loginLockoutMs());
  }

  clearedState() {
    return clearedLockoutState();
  }
}
