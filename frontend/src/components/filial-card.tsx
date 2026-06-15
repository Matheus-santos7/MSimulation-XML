"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteFilialAction } from "@/app/(app)/empresas/actions";
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
import { FilialForm } from "@/components/filial-form";
import type { UnidadeLogisticaDto } from "@/lib/fiscal-api";
import type { TenantFilialDto } from "@/lib/fiscal-types";

type Props = {
  filial: TenantFilialDto;
  unidades: UnidadeLogisticaDto[];
  /** Destaque quando esta filial é emitente de remessa ou transferência */
  papeis?: { remessa?: boolean; transferencia?: boolean };
};

export function FilialCard({ filial, unidades, papeis }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, startDelete] = useTransition();

  return (
    <>
      <div className="relative border border-border rounded-lg bg-card p-5 space-y-3 h-full">
        <div className="absolute top-3 right-3 flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            aria-label={`Editar ${filial.nomeFantasia}`}
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            aria-label={`Excluir ${filial.nomeFantasia}`}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>

        <div className="pr-16 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] uppercase font-bold tracking-widest text-muted-foreground">
              {filial.uf}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Filial
            </span>
          </div>
          <div className="text-base font-bold">{filial.nomeFantasia}</div>
          <div className="text-[13px] text-muted-foreground line-clamp-2">{filial.razaoSocial}</div>
        </div>

        <div className="space-y-1 font-mono text-[13px]">
          <div>
            <span className="text-muted-foreground">CNPJ:</span> {filial.cnpj}
          </div>
          <div>
            <span className="text-muted-foreground">IE:</span> {filial.ie}
          </div>
          <div className="text-muted-foreground truncate">
            {filial.logradouro}, {filial.numero} — {filial.municipio}/{filial.uf}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
          <span className="text-[12px] text-muted-foreground">
            Série remessa <span className="font-mono font-medium text-foreground">{filial.serieRemessa}</span>
          </span>
          {papeis?.remessa && <PapelBadge label="Emite remessas" />}
          {papeis?.transferencia && <PapelBadge label="Emite transferências" />}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar filial</DialogTitle>
            <DialogDescription>{filial.razaoSocial}</DialogDescription>
          </DialogHeader>
          <FilialForm
            embedded
            unidades={unidades}
            filial={filial}
            onCancel={() => setEditOpen(false)}
            onSaved={() => {
              setEditOpen(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir filial?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{filial.nomeFantasia}</strong> será removida permanentemente. Papéis fiscais
              vinculados a esta filial serão redefinidos para a matriz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletePending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                startDelete(async () => {
                  const result = await deleteFilialAction(filial.id);
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

function PapelBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
      {label}
    </span>
  );
}
