import type { ComponentProps } from "react";

export const authFieldInputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40";

type AuthFormFieldProps = {
  id: string;
  label: string;
} & Pick<
  ComponentProps<"input">,
  "name" | "type" | "autoComplete" | "required" | "placeholder" | "minLength" | "maxLength"
>;

/**
 * Campo de texto padrão dos formulários de autenticação (label + input).
 */
export function AuthFormField({
  id,
  label,
  name,
  type = "text",
  autoComplete,
  required,
  placeholder,
  minLength,
  maxLength,
}: AuthFormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        minLength={minLength}
        maxLength={maxLength}
        className={authFieldInputClass}
      />
    </div>
  );
}
