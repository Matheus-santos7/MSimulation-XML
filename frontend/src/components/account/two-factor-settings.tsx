"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import {
  disable2faAction,
  enable2faAction,
  start2faSetupAction,
  type SecurityActionState,
} from "@/lib/auth/actions";

const enableInitial: SecurityActionState = {};
const disableInitial: SecurityActionState = {};

export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [setup, setSetup] = useState<SecurityActionState["setup"]>();
  const [setupError, setSetupError] = useState<string>();
  const [pendingSetup, startSetup] = useTransition();
  const [enableState, enableAction, enablePending] = useActionState(enable2faAction, enableInitial);
  const [disableState, disableAction, disablePending] = useActionState(disable2faAction, disableInitial);

  useEffect(() => {
    if (enableState.success || disableState.success) {
      router.refresh();
    }
  }, [enableState.success, disableState.success, router]);

  function handleStartSetup() {
    setSetupError(undefined);
    startSetup(async () => {
      const result = await start2faSetupAction();
      if (result.error) {
        setSetupError(result.error);
        setSetup(undefined);
        return;
      }
      setSetup(result.setup);
    });
  }

  if (enabled) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-success">Autenticação em duas etapas está ativa.</p>
        <form action={disableAction} className="space-y-3 max-w-sm">
          <div className="space-y-1.5">
            <label htmlFor="disable-password" className="text-sm font-medium">
              Senha atual
            </label>
            <input
              id="disable-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="disable-code" className="text-sm font-medium">
              Código do autenticador
            </label>
            <input
              id="disable-code"
              name="code"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
            />
          </div>
          {disableState.error ? <Alert message={disableState.error} /> : null}
          {disableState.success ? <Success message={disableState.success} /> : null}
          <button
            type="submit"
            disabled={disablePending}
            className="rounded-md border border-destructive/50 text-destructive px-4 py-2 text-sm hover:bg-destructive/10 disabled:opacity-60"
          >
            {disablePending ? "Desativando…" : "Desativar 2FA"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Proteja sua conta com um código do Google Authenticator, Authy ou similar.
      </p>

      {!setup ? (
        <>
          {setupError ? <Alert message={setupError} /> : null}
          <button
            type="button"
            onClick={handleStartSetup}
            disabled={pendingSetup}
            className="rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
          >
            {pendingSetup ? "Gerando…" : "Configurar 2FA"}
          </button>
        </>
      ) : (
        <div className="space-y-4 max-w-md">
          <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Chave manual</p>
            <code className="block text-sm font-mono break-all select-all">{setup.secret}</code>
            <p className="text-xs text-muted-foreground pt-2">
              No app autenticador, adicione conta por chave ou use o link:
            </p>
            <a
              href={setup.otpauthUrl}
              className="text-xs text-accent break-all hover:underline"
            >
              {setup.otpauthUrl}
            </a>
          </div>

          <form action={enableAction} className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="enable-code" className="text-sm font-medium">
                Código de confirmação
              </label>
              <input
                id="enable-code"
                name="code"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                placeholder="000000"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
            {enableState.error ? <Alert message={enableState.error} /> : null}
            {enableState.success ? <Success message={enableState.success} /> : null}
            <button
              type="submit"
              disabled={enablePending}
              className="rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
            >
              {enablePending ? "Ativando…" : "Ativar 2FA"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function Alert({ message }: { message: string }) {
  return (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}

function Success({ message }: { message: string }) {
  return (
    <p className="text-sm text-success" role="status">
      {message}
    </p>
  );
}
