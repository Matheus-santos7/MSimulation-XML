"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { loginAction, registerAction, type LoginState, type RegisterState } from "@/lib/auth/actions";

export type AuthPanelMode = "login" | "register";

const loginInitial: LoginState = {};
const registerInitial: RegisterState = {};

/**
 * Gerencia o modo do painel (login/registro) e os estados das server actions associadas.
 */
export function useAuthPanel() {
  const [mode, setMode] = useState<AuthPanelMode>("login");
  const [turnstileKey, setTurnstileKey] = useState(0);
  const previousModeRef = useRef(mode);
  const [loginState, submitLogin, isLoginPending] = useActionState(loginAction, loginInitial);
  const [registerState, submitRegister, isRegisterPending] = useActionState(
    registerAction,
    registerInitial,
  );

  useEffect(() => {
    if (previousModeRef.current === mode) return;
    previousModeRef.current = mode;
    setTurnstileKey((current) => current + 1);
  }, [mode]);

  return {
    mode,
    setMode,
    turnstileKey,
    loginState,
    submitLogin,
    isLoginPending,
    registerState,
    submitRegister,
    isRegisterPending,
  };
}
