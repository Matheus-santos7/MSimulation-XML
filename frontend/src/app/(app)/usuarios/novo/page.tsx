import type { Metadata } from "next";
import Link from "next/link";
import { createUsuarioAction } from "../actions";
import { PageHeader } from "@/components/fiscal-ui";
import { UsuarioForm } from "@/components/usuario-form";

export const metadata: Metadata = { title: "Novo usuário" };

export default function NovoUsuarioPage() {
  return (
    <div className="p-6">
      <Link
        href="/usuarios"
        className="text-[12px] uppercase font-bold tracking-widest text-muted-foreground hover:text-foreground"
      >
        ← Voltar
      </Link>
      <PageHeader
        title="Novo usuário"
        subtitle="Credenciais de acesso vinculadas à empresa do seu login"
      />
      <UsuarioForm action={createUsuarioAction} submitLabel="Criar usuário" mode="create" />
    </div>
  );
}
