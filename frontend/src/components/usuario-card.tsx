"use client";

import { Pencil, Trash2, UserCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, useActionState } from "react";
import { deleteUsuarioAction, updateUsuarioModalAction } from "@/app/(app)/usuarios/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UsuarioFormFields } from "@/components/usuario-form-fields";
import type { UserDto } from "@/lib/fiscal-types";

type Props = {
  user: UserDto;
  currentUserId: string;
};

export function UsuarioCard({ user, currentUserId }: Props) {
  const router = useRouter();
  const isSelf = user.id === currentUserId;
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, startDelete] = useTransition();

  const boundUpdate = updateUsuarioModalAction.bind(null, user.id);
  const [editState, editAction, editPending] = useActionState(boundUpdate, {});

  useEffect(() => {
    if (editState.success) {
      setEditOpen(false);
      router.refresh();
    }
  }, [editState.success, router]);

  const createdAt = new Date(user.createdAt).toLocaleString("pt-BR");

  return (
    <>
      <div className="relative border border-border rounded-lg bg-card p-5 space-y-3">
        <div className="absolute top-3 right-3 flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            aria-label={`Editar ${user.email}`}
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive disabled:opacity-40"
            aria-label={`Excluir ${user.email}`}
            disabled={isSelf}
            title={isSelf ? "Não é possível excluir o usuário logado" : undefined}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>

        <div className="pr-16 flex items-start gap-3">
          <div className="size-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
            <UserCircle2 className="size-5 text-accent" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-semibold truncate">{user.name ?? "Sem nome"}</div>
            <div className="text-[13px] font-mono text-muted-foreground truncate">{user.email}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border text-[12px]">
          {isSelf && (
            <span className="font-bold uppercase tracking-widest text-brand-xml bg-brand-xml/10 border border-brand-xml/25 rounded px-2 py-0.5">
              Você
            </span>
          )}
          <span className="text-muted-foreground">Criado em {createdAt}</span>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <DialogDescription>{user.email}</DialogDescription>
          </DialogHeader>
          <form action={editAction} className="space-y-4">
            {editState.error && <FormError error={editState.error} />}
            <UsuarioFormFields
              user={user}
              draft={editState.values}
              fieldErrors={editState.fieldErrors}
              idPrefix={`edit-${user.id}`}
              mode="edit"
            />
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={editPending}>
                {editPending ? "Salvando…" : "Salvar"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{user.email}</strong> perderá o acesso a esta empresa. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletePending || isSelf}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                startDelete(async () => {
                  const result = await deleteUsuarioAction(user.id);
                  if (result.error) {
                    alert(result.error);
                    return;
                  }
                  setDeleteOpen(false);
                  router.refresh();
                })
              }
            >
              {deletePending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function FormError({ error }: { error: string }) {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[14px] text-destructive">
      {error}
    </div>
  );
}
