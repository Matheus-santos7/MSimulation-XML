import { Injectable } from "@nestjs/common";
import { generateOpaqueToken, hashOpaqueToken } from "../../../lib/auth/token.js";

const REFRESH_TOKEN_BYTES = 48;
const LINK_TOKEN_BYTES = 32;

/**
 * Tokens opacos (aleatórios) do auth. O banco guarda só o hash, com um namespace por uso,
 * para um token de um fluxo não valer em outro.
 */
@Injectable()
export class OpaqueTokenProvider {
  generateRefreshToken(): string {
    return generateOpaqueToken(REFRESH_TOKEN_BYTES);
  }

  hashRefreshToken(token: string): string {
    return hashOpaqueToken(token, "refresh");
  }

  generatePasswordResetToken(): string {
    return generateOpaqueToken(LINK_TOKEN_BYTES);
  }

  hashPasswordResetToken(token: string): string {
    return hashOpaqueToken(token, "password-reset");
  }

  generateEmailVerificationToken(): string {
    return generateOpaqueToken(LINK_TOKEN_BYTES);
  }

  hashEmailVerificationToken(token: string): string {
    return hashOpaqueToken(token, "email-verify");
  }
}
