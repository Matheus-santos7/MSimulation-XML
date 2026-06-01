import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { Verify2faForm } from "@/components/auth/verify-2fa-form";
import { getTwoFactorPending } from "@/lib/auth/session";

export default async function Verificar2faPage() {
  const pending = await getTwoFactorPending();
  if (!pending) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-center">
          <BrandLogo variant="compact" href="/login" />
        </div>
        <div className="border border-border rounded-xl bg-card/50 backdrop-blur-sm p-8 space-y-6">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Verificação em duas etapas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Abra seu aplicativo autenticador e informe o código de 6 dígitos.
            </p>
          </div>
          <Verify2faForm />
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
