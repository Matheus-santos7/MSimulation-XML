import Link from "next/link";
import { AuthCardShell } from "@/components/auth/auth-card-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function RedefinirSenhaPage({ searchParams }: Props) {
  const { token } = await searchParams;

  return (
    <AuthCardShell title="Nova senha" description="Escolha uma senha forte para a sua conta.">
      {!token ? (
        <div className="space-y-4">
          <p className="text-sm text-destructive" role="alert">
            Link inválido ou incompleto. Solicite um novo e-mail de redefinição.
          </p>
          <Link
            href="/login/esqueci-senha"
            className="inline-block text-sm text-accent hover:underline"
          >
            Solicitar novo link
          </Link>
        </div>
      ) : (
        <ResetPasswordForm token={token} />
      )}
    </AuthCardShell>
  );
}
