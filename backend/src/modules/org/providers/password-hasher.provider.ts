import { Injectable } from "@nestjs/common";
import { hashPassword } from "../../../lib/auth/password.js";

/** Hash da senha de usuários criados ou alterados pelo ADMIN. */
@Injectable()
export class PasswordHasherProvider {
  hash(password: string): Promise<string> {
    return hashPassword(password);
  }
}
