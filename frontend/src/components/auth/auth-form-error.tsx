type AuthFormErrorProps = {
  message?: string;
};

/**
 * Exibe mensagens de erro retornadas pelas server actions de autenticação.
 */
export function AuthFormError({ message }: AuthFormErrorProps) {
  if (!message) return null;

  return (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}
