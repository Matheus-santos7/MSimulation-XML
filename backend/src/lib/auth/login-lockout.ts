import { loginLockoutMs, loginMaxFailedAttempts } from "./config.js";

export function isLoginLocked(lockedUntil: Date | null | undefined): boolean {
  return lockedUntil != null && lockedUntil > new Date();
}

export function lockoutMessage(lockedUntil: Date): string {
  const minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60_000));
  return `Muitas tentativas de login. Aguarde ${minutes} minuto(s) e tente novamente.`;
}

export function nextLockoutState(currentAttempts: number): {
  failedLoginAttempts: number;
  lockedUntil: Date | null;
} {
  const attempts = currentAttempts + 1;
  if (attempts >= loginMaxFailedAttempts()) {
    return {
      failedLoginAttempts: attempts,
      lockedUntil: new Date(Date.now() + loginLockoutMs()),
    };
  }
  return { failedLoginAttempts: attempts, lockedUntil: null };
}

export function clearedLockoutState() {
  return { failedLoginAttempts: 0, lockedUntil: null };
}
