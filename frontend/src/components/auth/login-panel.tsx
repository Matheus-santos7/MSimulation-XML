"use client";

import { Suspense, useState } from "react";
import { RegisterCaptchaField, isTurnstileRequired } from "@/components/auth/register-captcha-field";
import { SessionExpiredBanner } from "@/components/auth/session-expired-banner";
import { AuthFormField } from "@/components/auth/auth-form-field";
import { AuthFormError } from "@/components/auth/auth-form-error";
import { AuthModeToggle } from "@/components/auth/auth-mode-toggle";
import { AuthPasswordField } from "@/components/auth/auth-password-field";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { useAuthPanel } from "@/hooks/use-auth-panel";
import type { LoginState, RegisterState } from "@/lib/auth/actions";

export function LoginPanel() {
  const {
    mode,
    setMode,
    loginState,
    submitLogin,
    isLoginPending,
    registerState,
    submitRegister,
    isRegisterPending,
  } = useAuthPanel();

  return (
    <div className="border border-border rounded-xl bg-card/50 backdrop-blur-sm p-8 space-y-6">
      <Suspense fallback={null}>
        <SessionExpiredBanner />
      </Suspense>

      <AuthModeToggle mode={mode} onModeChange={setMode} />

      {mode === "login" ? (
        <LoginForm state={loginState} action={submitLogin} pending={isLoginPending} />
      ) : (
        <RegisterForm state={registerState} action={submitRegister} pending={isRegisterPending} />
      )}
    </div>
  );
}

type LoginFormProps = {
  state: LoginState;
  action: (formData: FormData) => void;
  pending: boolean;
};

function LoginForm({ state, action, pending }: LoginFormProps) {
  const [captchaReady, setCaptchaReady] = useState(!isTurnstileRequired());

  return (
    <form action={action} className="space-y-4">
      <AuthFormField
        id="email"
        name="email"
        label="E-mail"
        type="email"
        autoComplete="username"
        required
      />
      <AuthPasswordField id="password" mode="login" />
      <RegisterCaptchaField onReadyChange={setCaptchaReady} />
      <AuthFormError message={state.error} />
      <AuthSubmitButton
        pending={pending}
        disabled={!captchaReady}
        idleLabel="Entrar"
        pendingLabel="Entrando…"
      />
    </form>
  );
}

type RegisterFormProps = {
  state: RegisterState;
  action: (formData: FormData) => void;
  pending: boolean;
};

function RegisterForm({ state, action, pending }: RegisterFormProps) {
  const [captchaReady, setCaptchaReady] = useState(!isTurnstileRequired());

  return (
    <form action={action} className="space-y-4">
      <AuthFormField
        id="reg-name"
        name="name"
        label="Nome"
        type="text"
        autoComplete="name"
        placeholder="Opcional"
      />
      <AuthFormField
        id="reg-email"
        name="email"
        label="E-mail"
        type="email"
        autoComplete="username"
        required
      />
      <AuthPasswordField id="reg-password" mode="register" />
      <RegisterCaptchaField onReadyChange={setCaptchaReady} />
      <AuthFormError message={state.error} />
      <AuthSubmitButton
        pending={pending}
        disabled={!captchaReady}
        idleLabel="Criar conta e continuar"
        pendingLabel="Criando…"
      />
    </form>
  );
}
