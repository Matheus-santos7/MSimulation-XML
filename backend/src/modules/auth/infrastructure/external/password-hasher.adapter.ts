import {
  authFailureDelay,
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword,
} from "../../../../lib/auth/password.js";
import type { PasswordHasherPort } from "../../domain/ports/password-hasher.port.js";

export class PasswordHasherAdapter implements PasswordHasherPort {
  readonly dummyPasswordHash = DUMMY_PASSWORD_HASH;

  hash(password: string): Promise<string> {
    return hashPassword(password);
  }

  verify(password: string, hash: string): Promise<boolean> {
    return verifyPassword(password, hash);
  }

  authFailureDelay(): Promise<void> {
    return authFailureDelay();
  }
}
