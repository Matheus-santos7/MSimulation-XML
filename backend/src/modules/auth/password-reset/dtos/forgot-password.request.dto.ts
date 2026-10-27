import { z } from "zod";
import { captchaTokenField, emailField } from "../../rules/credential.schemas.js";

export const forgotPasswordRequestSchema = z.object({
  email: emailField,
  captchaToken: captchaTokenField,
});

export type ForgotPasswordRequestDTO = z.infer<typeof forgotPasswordRequestSchema>;
