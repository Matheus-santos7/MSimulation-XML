export type LoginLockoutState = {
  failedLoginAttempts: number;
  lockedUntil: Date | null;
};

export function isLoginLocked(
  lockedUntil: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  return lockedUntil != null && lockedUntil > now;
}

export function lockoutMessage(lockedUntil: Date, now: Date = new Date()): string {
  const minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 60_000));
  return `Muitas tentativas de login. Aguarde ${minutes} minuto(s) e tente novamente.`;
}

export function nextLockoutState(
  currentAttempts: number,
  maxAttempts: number,
  lockoutMs: number,
  now: Date = new Date(),
): LoginLockoutState {
  const attempts = currentAttempts + 1;
  if (attempts >= maxAttempts) {
    return {
      failedLoginAttempts: attempts,
      lockedUntil: new Date(now.getTime() + lockoutMs),
    };
  }
  return { failedLoginAttempts: attempts, lockedUntil: null };
}

export function clearedLockoutState(): LoginLockoutState {
  return { failedLoginAttempts: 0, lockedUntil: null };
}
