import { hashPassword } from "../../../../lib/auth/password.js";
import type { PasswordHasherPort } from "../../domain/ports/password-hasher.port.js";

export class PasswordHasherAdapter implements PasswordHasherPort {
  hash(password: string): Promise<string> {
    return hashPassword(password);
  }
}
