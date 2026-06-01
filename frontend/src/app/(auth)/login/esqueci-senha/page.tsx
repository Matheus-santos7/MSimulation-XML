import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function EsqueciSenhaPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-center">
          <BrandLogo variant="compact" href="/login" />
        </div>
        <div className="border border-border rounded-xl bg-card/50 backdrop-blur-sm p-8 space-y-6">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Esqueci minha senha</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Informe o e-mail da conta. Se estiver cadastrado, enviaremos um link para redefinir a senha.
            </p>
          </div>
          <ForgotPasswordForm />
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
