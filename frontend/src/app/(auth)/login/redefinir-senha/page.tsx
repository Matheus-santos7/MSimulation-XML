import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function RedefinirSenhaPage({ searchParams }: Props) {
  const { token } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-center">
          <BrandLogo variant="compact" href="/login" />
        </div>
        <div className="border border-border rounded-xl bg-card/50 backdrop-blur-sm p-8 space-y-6">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Nova senha</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Escolha uma senha forte para a sua conta.
            </p>
          </div>
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
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="text-accent hover:underline">
              Voltar ao login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
