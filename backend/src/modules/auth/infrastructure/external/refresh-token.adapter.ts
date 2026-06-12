import { generateRefreshToken, hashRefreshToken } from "../../../../lib/auth/refresh-token.js";
import type { RefreshTokenPort } from "../../domain/ports/refresh-token.port.js";

export class RefreshTokenAdapter implements RefreshTokenPort {
  generate(): string {
    return generateRefreshToken();
  }

  hash(token: string): string {
    return hashRefreshToken(token);
  }
}
