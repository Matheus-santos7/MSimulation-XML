export type ResetPasswordCommand = {
  token: string;
  password: string;
  code?: string;
};
