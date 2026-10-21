import type { createAuthModule } from "./infrastructure/factory/auth-module.factory.js";

/** Composition root do Auth (sessão, 2FA, e-mail, onboarding), injetado nos controllers Nest. */
export const AUTH = Symbol("AUTH");

export type AuthContext = ReturnType<typeof createAuthModule>;
