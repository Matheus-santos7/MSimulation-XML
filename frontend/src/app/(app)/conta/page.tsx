import type { Metadata } from "next";
import Link from "next/link";
import { AccountProfileForm } from "@/components/auth/account-profile-form";
import { getAuthMe } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Minha conta" };

export default async function ContaPage() {
  const me = await getAuthMe();
  if (!me) redirect("/login?session=expired");

  return (
    <div className="p-6 max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Minha conta</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Dados do usuário conectado nesta empresa.
        </p>
      </div>

      {me.tenant ? (
        <section className="rounded-xl border border-border bg-card/40 p-4 text-sm space-y-1">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">Empresa ativa</p>
          <p className="font-medium">{me.tenant.razaoSocial}</p>
          <p className="text-muted-foreground font-mono text-xs">CNPJ {me.tenant.cnpj}</p>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-card/40 p-6 space-y-4">
        <h2 className="text-base font-semibold">Perfil</h2>
        <AccountProfileForm email={me.email} initialName={me.name ?? ""} />
      </section>

      <p className="text-sm text-muted-foreground">
        Autenticação em duas etapas e bloqueio de login em{" "}
        <Link href="/conta/seguranca" className="text-accent hover:underline">
          Segurança
        </Link>
        .
      </p>
    </div>
  );
}
