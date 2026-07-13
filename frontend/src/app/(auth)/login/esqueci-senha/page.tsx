import { AuthCardShell } from "@/components/auth/auth-card-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function EsqueciSenhaPage() {
  return (
    <AuthCardShell
      title="Esqueci minha senha"
      description="Informe o e-mail da conta. Se estiver cadastrado, enviaremos um link para redefinir a senha."
    >
      <ForgotPasswordForm />
    </AuthCardShell>
  );
}
