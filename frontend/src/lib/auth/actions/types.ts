export type LoginState = { error?: string; fieldErrors?: Record<string, string[]> };
export type RegisterState = { error?: string; fieldErrors?: Record<string, string[]> };
export type ForgotPasswordState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
};
export type ResetPasswordState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
};
export type Verify2faState = { error?: string; fieldErrors?: Record<string, string[]> };

export type SecurityActionState = {
  error?: string;
  success?: string;
  setup?: { secret: string; otpauthUrl: string; issuer: string };
};
