import { z } from "zod";
import { linkTokenField } from "../../rules/credential.schemas.js";

export const verifyEmailRequestSchema = z.object({
  token: linkTokenField,
});

export type VerifyEmailRequestDTO = z.infer<typeof verifyEmailRequestSchema>;
