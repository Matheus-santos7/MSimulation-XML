"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Suspense, useState, useActionState } from "react";
import { loginAction, registerAction, type LoginState, type RegisterState } from "@/lib/auth/actions";
import { RegisterCaptchaField } from "@/components/auth/register-captcha-field";
import { SessionExpiredBanner } from "@/components/auth/session-expired-banner";
import { PASSWORD_POLICY_HINT } from "@/lib/auth/password-policy";
import { cn } from "@/lib/utils";

const loginInitial: LoginState = {};
const registerInitial: RegisterState = {};

type Mode = "login" | "register";

export function LoginPanel() {
  const [mode, setMode] = useState<Mode>("login");
  const [loginState, loginFormAction, loginPending] = useActionState(loginAction, loginInitial);
  const [registerState, registerFormAction, registerPending] = useActionState(
    registerAction,
    registerInitial,
  );

  const pending = mode === "login" ? loginPending : registerPending;
  const error = mode === "login" ? loginState.error : registerState.error;

  return (
    <div className="border border-border rounded-xl bg-card/50 backdrop-blur-sm p-8 space-y-6 shadow-[0_0_40px_-12px_oklch(0.769_0.166_70.5_/_0.15)]">
      <Suspense fallback={null}>
        <SessionExpiredBanner />
      </Suspense>

      <div>
        <div className="flex rounded-lg border border-border p-1 mb-4">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={cn(
              "flex-1 rounded-md py-2 text-sm font-medium transition-colors",
              mode === "login"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={cn(
              "flex-1 rounded-md py-2 text-sm font-medium transition-colors",
              mode === "register"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Criar conta
          </button>
        </div>
        <h1 className="text-lg font-semibold tracking-tight">
          {mode === "login" ? "Entrar" : "Criar conta"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {mode === "login"
            ? "Acesse o MSimulation XML para simular seus documentos fiscais."
            : "Crie sua conta e em seguida cadastre a empresa emitente."}
        </p>
      </div>

      {mode === "login" ? (
        <form action={loginFormAction} className="space-y-4">
          <AuthFields mode="login" />
          {error ? <AuthError message={error} /> : null}
          <SubmitButton pending={pending} label={pending ? "Entrando…" : "Entrar"} />
        </form>
      ) : (
        <form action={registerFormAction} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="reg-name" className="text-sm font-medium">
              Nome
            </label>
            <input
              id="reg-name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Opcional"
              className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <AuthFields mode="register" />
          <RegisterCaptchaField />
          {error ? <AuthError message={error} /> : null}
          <SubmitButton pending={pending} label={pending ? "Criando…" : "Criar conta e continuar"} />
        </form>
      )}


    </div>
  );
}

function AuthFields({ mode }: { mode: Mode }) {
  const [showPassword, setShowPassword] = useState(false);
  const emailId = mode === "login" ? "email" : "reg-email";
  const passwordId = mode === "login" ? "password" : "reg-password";

  return (
    <>
      <div className="space-y-1.5">
        <label htmlFor={emailId} className="text-sm font-medium">
          E-mail
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="username"
          required
          className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={passwordId} className="text-sm font-medium">
          Senha
        </label>
        <div className="relative">
          <input
            id={passwordId}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={mode === "register" ? 8 : 1}
            maxLength={128}
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
          >
            {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>
        {mode === "login" ? (
          <p className="text-right">
            <Link
              href="/login/esqueci-senha"
              className="text-xs text-muted-foreground hover:text-accent transition-colors"
            >
              Esqueci minha senha
            </Link>
          </p>
        ) : null}
        {mode === "register" ? (
          <p className="text-xs text-muted-foreground">{PASSWORD_POLICY_HINT}</p>
        ) : null}
      </div>
    </>
  );
}

function AuthError({ message }: { message: string }) {
  return (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-accent text-accent-foreground py-2.5 text-sm font-semibold tracking-wide hover:opacity-90 transition-opacity disabled:opacity-60"
    >
      {label}
    </button>
  );
}
