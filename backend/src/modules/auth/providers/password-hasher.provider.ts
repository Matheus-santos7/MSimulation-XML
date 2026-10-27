import { Injectable } from "@nestjs/common";
import {
  authFailureDelay,
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword,
} from "../../../lib/auth/password.js";

/** Hash de senha (com pepper) e atraso uniforme nas falhas de autenticação. */
@Injectable()
export class PasswordHasherProvider {
  /** Hash usado quando o e-mail não existe, para o login levar o mesmo tempo. */
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
