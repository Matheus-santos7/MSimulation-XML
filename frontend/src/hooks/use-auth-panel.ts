"use client";

import { useActionState, useState } from "react";
import { loginAction, registerAction, type LoginState, type RegisterState } from "@/lib/auth/actions";

export type AuthPanelMode = "login" | "register";

const loginInitial: LoginState = {};
const registerInitial: RegisterState = {};

/**
 * Gerencia o modo do painel (login/registro) e os estados das server actions associadas.
 */
export function useAuthPanel() {
  const [mode, setMode] = useState<AuthPanelMode>("login");
  const [loginState, submitLogin, isLoginPending] = useActionState(loginAction, loginInitial);
  const [registerState, submitRegister, isRegisterPending] = useActionState(
    registerAction,
    registerInitial,
  );

  return {
    mode,
    setMode,
    loginState,
    submitLogin,
    isLoginPending,
    registerState,
    submitRegister,
    isRegisterPending,
  };
}
