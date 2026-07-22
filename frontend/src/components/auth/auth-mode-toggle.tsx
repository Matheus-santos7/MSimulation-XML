import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { AuthPanelMode } from "@/hooks/use-auth-panel";

const MODE_COPY: Record<AuthPanelMode, { title: string; description: string }> = {
  login: {
    title: "Entrar",
    description: "Acesse o MSimulation XML para simular seus documentos fiscais.",
  },
  register: {
    title: "Criar conta",
    description: "Crie sua conta e em seguida cadastre a empresa emitente.",
  },
};

type AuthModeToggleProps = {
  mode: AuthPanelMode;
  onModeChange: (mode: AuthPanelMode) => void;
};

/**
 * Alterna entre os modos de login e registro e exibe o cabeçalho contextual.
 */
export function AuthModeToggle({ mode, onModeChange }: AuthModeToggleProps) {
  const copy = MODE_COPY[mode];

  return (
    <div className="space-y-5">
      <div className="flex rounded-xl bg-muted/60 p-1">
        <ModeButton active={mode === "login"} onClick={() => onModeChange("login")}>
          Entrar
        </ModeButton>
        <ModeButton active={mode === "register"} onClick={() => onModeChange("register")}>
          Criar conta
        </ModeButton>
      </div>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{copy.description}</p>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
