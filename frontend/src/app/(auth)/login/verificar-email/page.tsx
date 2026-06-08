import Link from "next/link";
import { redirect } from "next/navigation";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";
import { verifyEmailApi } from "@/lib/auth/api";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerificarEmailPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (token) {
    try {
      await verifyEmailApi(token);
      redirect("/onboarding/empresa?email=verified");
    } catch {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="border border-border rounded-xl bg-card/50 backdrop-blur-sm p-8 space-y-4 max-w-md w-full">
            <h1 className="text-lg font-semibold">Link inválido ou expirado</h1>
            <p className="text-sm text-muted-foreground">Solicite um novo e-mail de confirmação abaixo.</p>
            <ResendVerificationForm />
            <Link href="/login" className="text-sm text-accent hover:underline">
              Voltar ao login
            </Link>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="border border-border rounded-xl bg-card/50 backdrop-blur-sm p-8 space-y-6 max-w-md w-full shadow-[0_0_40px_-12px_oklch(0.769_0.166_70.5_/_0.15)]">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Confirme seu e-mail</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Enviamos um link de confirmação para o seu e-mail. Abra o link para continuar com o cadastro
            da empresa.
          </p>
        </div>
        <ResendVerificationForm />
        <p className="text-xs text-muted-foreground">
          Já confirmou?{" "}
          <Link href="/onboarding/empresa" className="text-accent hover:underline">
            Continuar para cadastro da empresa
          </Link>
        </p>
      </div>
    </div>
  );
}
