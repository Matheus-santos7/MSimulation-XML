"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { PASSWORD_POLICY_HINT } from "@/lib/auth/password-policy";
import { cn } from "@/lib/utils";
import { authFieldInputClass } from "@/components/auth/auth-form-field";

type AuthPasswordFieldProps = {
  id: string;
  mode: "login" | "register";
};

/**
 * Campo de senha com alternância de visibilidade e hints contextuais por modo.
 */
export function AuthPasswordField({ id, mode }: AuthPasswordFieldProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        Senha
      </label>
      <div className="relative">
        <input
          id={id}
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={mode === "register" ? 8 : 1}
          maxLength={128}
          className={cn(authFieldInputClass, "pr-10")}
        />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
            aria-controls={id}
            aria-pressed={showPassword}
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
      ) : (
        <p className="text-xs text-muted-foreground">{PASSWORD_POLICY_HINT}</p>
      )}
    </div>
  );
}
