import { Module } from "@nestjs/common";
import { AUTH } from "./auth.tokens.js";
import { createAuthModule } from "./infrastructure/factory/auth-module.factory.js";
import { AuthController } from "./presentation/controllers/auth.controller.js";
import { OnboardingController } from "./presentation/controllers/onboarding.controller.js";

@Module({
  controllers: [AuthController, OnboardingController],
  providers: [{ provide: AUTH, useFactory: createAuthModule }],
})
export class AuthModule {}
