import { TwoFactorSettings } from "@/components/auth/two-factor-settings";
import { fetch2faStatus } from "@/lib/auth/api";
import { getAuthMe, resolveAccessToken } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function ContaSegurancaPage() {
  const me = await getAuthMe();
  if (!me) redirect("/login?session=expired");

  const token = await resolveAccessToken();
  if (!token) redirect("/login?session=expired");

  const status = await fetch2faStatus(token);

  return (
    <div className="p-6 max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Segurança da conta</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Autenticação em duas etapas e proteções de login.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card/40 p-6 space-y-4">
        <h2 className="text-base font-semibold">Autenticação em duas etapas (2FA)</h2>
        <TwoFactorSettings enabled={status.enabled} />
      </section>

      <section className="rounded-xl border border-border bg-card/40 p-6 space-y-2">
        <h2 className="text-base font-semibold">Bloqueio por tentativas</h2>
        <p className="text-sm text-muted-foreground">
          Após várias senhas incorretas, o login é bloqueado temporariamente. Use
          &quot;Esqueci minha senha&quot; ou aguarde o desbloqueio automático.
        </p>
      </section>
    </div>
  );
}
