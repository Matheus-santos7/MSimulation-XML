"use client";

import type { UsuarioFormState } from "@/lib/usuario-form";
import type { UserDto } from "@/lib/fiscal-types";

type Props = {
  user?: UserDto;
  draft?: UsuarioFormState["values"];
  fieldErrors?: Record<string, string[]>;
  idPrefix?: string;
  /** Edição: senha opcional; criação: obrigatória. */
  mode?: "create" | "edit";
};

function fieldError(fieldErrors: Record<string, string[]> | undefined, key: string): string | undefined {
  return fieldErrors?.[key]?.[0];
}

export function UsuarioFormFields({
  user,
  draft,
  fieldErrors,
  idPrefix = "usuario",
  mode = user ? "edit" : "create",
}: Props) {
  const email = draft?.email ?? user?.email ?? "";
  const name = draft?.name ?? user?.name ?? "";
  const password = draft?.password ?? "";

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-email`} className="text-sm font-medium">
          E-mail
        </label>
        <input
          id={`${idPrefix}-email`}
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={email}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        {fieldError(fieldErrors, "email") && (
          <p className="text-xs text-destructive">{fieldError(fieldErrors, "email")}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-name`} className="text-sm font-medium">
          Nome
        </label>
        <input
          id={`${idPrefix}-name`}
          name="name"
          type="text"
          autoComplete="name"
          defaultValue={name}
          placeholder="Opcional"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        {fieldError(fieldErrors, "name") && (
          <p className="text-xs text-destructive">{fieldError(fieldErrors, "name")}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-password`} className="text-sm font-medium">
          Senha{mode === "edit" ? " (deixe em branco para manter)" : ""}
        </label>
        <input
          id={`${idPrefix}-password`}
          name="password"
          type="password"
          autoComplete={mode === "create" ? "new-password" : "off"}
          required={mode === "create"}
          defaultValue={password}
          minLength={mode === "create" ? 6 : undefined}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        {fieldError(fieldErrors, "password") && (
          <p className="text-xs text-destructive">{fieldError(fieldErrors, "password")}</p>
        )}
      </div>
    </div>
  );
}
