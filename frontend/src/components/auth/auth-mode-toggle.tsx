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
    <div>
      <div className="flex rounded-lg border border-border p-1 mb-4">
        <ModeButton active={mode === "login"} onClick={() => onModeChange("login")}>
          Entrar
        </ModeButton>
        <ModeButton active={mode === "register"} onClick={() => onModeChange("register")}>
          Criar conta
        </ModeButton>
      </div>
      <h1 className="text-lg font-semibold tracking-tight">{copy.title}</h1>
      <p className="text-sm text-muted-foreground mt-1">{copy.description}</p>
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
        "flex-1 rounded-md py-2 text-sm font-medium transition-colors",
        active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
