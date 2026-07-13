import { redirect } from "next/navigation";
import { AuthCardShell } from "@/components/auth/auth-card-shell";
import { Verify2faForm } from "@/components/auth/verify-2fa-form";
import { getTwoFactorPending } from "@/lib/auth/session";

export default async function Verificar2faPage() {
  const pending = await getTwoFactorPending();
  if (!pending) {
    redirect("/login");
  }

  return (
    <AuthCardShell
      title="Verificação em duas etapas"
      description="Abra seu aplicativo autenticador e informe o código de 6 dígitos."
    >
      <Verify2faForm />
    </AuthCardShell>
  );
}
