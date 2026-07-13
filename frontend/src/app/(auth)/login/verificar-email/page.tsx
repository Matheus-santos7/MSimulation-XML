import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCardShell } from "@/components/auth/auth-card-shell";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";
import { verifyEmailAction } from "@/lib/auth/actions/credentials";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerificarEmailPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (token) {
    const result = await verifyEmailAction(token);
    if (result.ok) {
      redirect("/onboarding/empresa?email=verified");
    }
    return (
      <AuthCardShell
        title="Link inválido ou expirado"
        description={
          "error" in result ? result.error : "Solicite um novo e-mail de confirmação abaixo."
        }
      >
        <ResendVerificationForm />
      </AuthCardShell>
    );
  }

  return (
    <AuthCardShell
      title="Confirme seu e-mail"
      description="Enviamos um link de confirmação para o seu e-mail. Abra o link para continuar com o cadastro da empresa."
      showBackToLogin={false}
      footer={
        <p className="text-xs text-muted-foreground">
          Já confirmou?{" "}
          <Link href="/onboarding/empresa" className="text-accent hover:underline">
            Continuar para cadastro da empresa
          </Link>
          {" · "}
          <Link href="/login" className="text-accent hover:underline">
            Voltar ao login
          </Link>
        </p>
      }
    >
      <ResendVerificationForm />
    </AuthCardShell>
  );
}
