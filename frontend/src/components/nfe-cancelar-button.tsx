"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelarVendaAction } from "@/app/(app)/nfe/actions";
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

type Props = {
  chave: string;
  label: string;
  desabilitado?: boolean;
  motivoDesabilitado?: string;
};

export function NfeCancelarButton({ chave, label, desabilitado, motivoDesabilitado }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const title = motivoDesabilitado ?? "Cancelar NF-e de venda (e retorno da cadeia)";

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 text-red-500 bg-red-500/10 hover:bg-red-500/20 hover:text-red-400 ring-1 ring-red-500/30 disabled:opacity-30 disabled:bg-transparent disabled:ring-0"
        aria-label={`Cancelar venda ${label}`}
        title={title}
        disabled={desabilitado}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <X className="size-3.5" />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar venda {label}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Será registrado o evento SEFAZ <strong className="text-foreground">110111</strong> (cancelamento)
                  nesta venda.
                </p>
                <p>
                  O <strong className="text-foreground">retorno simbólico</strong> referenciado será cancelado
                  automaticamente e o saldo consumido das remessas será estornado (FIFO).
                </p>
                <p>O CT-e de venda vinculado também será cancelado, se existir.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-[13px] text-destructive px-1">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  const result = await cancelarVendaAction(chave);
                  if (result.error) {
                    setError(result.error);
                    return;
                  }
                  setOpen(false);
                  router.refresh();
                });
              }}
            >
              {pending ? "Cancelando…" : "Confirmar cancelamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
