import { z } from "zod";
import {
  captchaTokenField,
  currentPasswordField,
  emailField,
} from "../../rules/credential.schemas.js";

export const loginRequestSchema = z.object({
  email: emailField,
  password: currentPasswordField,
  captchaToken: captchaTokenField,
});

export type LoginRequestDTO = z.infer<typeof loginRequestSchema>;
