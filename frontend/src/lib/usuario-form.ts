import type { UserInput, UserUpdateInput } from "@/lib/fiscal-types";

export type UsuarioFormValues = {
  email: string;
  name: string;
  password: string;
};

export type UsuarioFormState = {
  error?: string;
  success?: boolean;
  fieldErrors?: Record<string, string[]>;
  values?: UsuarioFormValues;
};

export function inputToFormValues(input: UserInput): UsuarioFormValues {
  return {
    email: input.email,
    name: input.name ?? "",
    password: input.password,
  };
}

export function userToFormValues(user: { email: string; name?: string }): UsuarioFormValues {
  return {
    email: user.email,
    name: user.name ?? "",
    password: "",
  };
}

export function formatFieldErrors(fieldErrors?: Record<string, string[]>): string | undefined {
  if (!fieldErrors) return undefined;
  const msgs = Object.entries(fieldErrors).flatMap(([, v]) => v);
  return msgs.length > 0 ? msgs.join(" • ") : undefined;
}

export function parseUsuarioCreateForm(formData: FormData): UserInput {
  const name = String(formData.get("name") ?? "").trim();
  return {
    email: String(formData.get("email") ?? "").trim(),
    name: name.length > 0 ? name : undefined,
    password: String(formData.get("password") ?? ""),
  };
}

export function parseUsuarioUpdateForm(formData: FormData): UserUpdateInput {
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  return {
    email: String(formData.get("email") ?? "").trim(),
    name: name.length > 0 ? name : undefined,
    ...(password.length > 0 ? { password } : {}),
  };
}
