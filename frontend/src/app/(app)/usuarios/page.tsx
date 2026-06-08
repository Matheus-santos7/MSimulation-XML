import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/fiscal-ui";
import { UsuarioCard } from "@/components/usuario-card";
import { Button } from "@/components/ui/button";
import { getUsers } from "@/lib/fiscal-api";
import { isAdminRole } from "@/lib/auth/roles";
import { getAuthMe } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Usuários" };

export default async function UsuariosPage() {
  const [users, me] = await Promise.all([getUsers(), getAuthMe()]);
  const currentUserId = me?.userId ?? "";
  const canManage = isAdminRole(me?.role);

  return (
    <div className="p-6">
      <PageHeader
        title="Usuários"
        subtitle="Acesso ao cockpit fiscal desta empresa"
        actions={
          canManage ? (
            <Button asChild>
              <Link href="/usuarios/novo">Novo usuário</Link>
            </Button>
          ) : undefined
        }
      />

      {users.length === 0 ? (
        <div className="text-muted-foreground">
          Nenhum usuário cadastrado.{" "}
          <Link href="/usuarios/novo" className="text-accent hover:underline">
            Criar o primeiro
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {users.map((user) => (
            <UsuarioCard key={user.id} user={user} currentUserId={currentUserId} canManage={canManage} />
          ))}
        </div>
      )}
    </div>
  );
}
