type AuthSubmitButtonProps = {
  pending: boolean;
  disabled?: boolean;
  idleLabel: string;
  pendingLabel: string;
};

/**
 * Botão de envio padrão dos formulários de autenticação.
 */
export function AuthSubmitButton({
  pending,
  disabled = false,
  idleLabel,
  pendingLabel,
}: AuthSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full rounded-md bg-accent text-accent-foreground py-2.5 text-sm font-semibold tracking-wide hover:opacity-90 transition-opacity disabled:opacity-60"
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
