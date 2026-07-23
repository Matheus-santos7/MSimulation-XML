"use client";

import { PackageMinus, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  emitirInsucessoAction,
  emitirRetornoFisicoAction,
} from "@/app/(app)/nfe/actions";
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

type InsucessoProps = {
  chave: string;
  label: string;
  disabled?: boolean;
};

export function NfeInsucessoButton({ chave, label, disabled }: InsucessoProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 hover:text-amber-500 ring-1 ring-amber-500/30 disabled:opacity-30"
        aria-label={`Emitir insucesso de entrega da venda ${label}`}
        title={disabled ? "Já possui devolução/insucesso" : "Emitir insucesso de entrega"}
        disabled={disabled}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <PackageMinus className="size-3.5" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Emitir insucesso de entrega da venda {label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Será emitida NF-e `INSULCESSO_DE_ENTREGA` referenciando esta venda (mesmo fluxo
              fiscal da devolução, com texto de infCpl específico).
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-[13px] text-destructive px-1">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  const result = await emitirInsucessoAction(chave);
                  if (result.error) {
                    setError(result.error);
                    return;
                  }
                  setOpen(false);
                  router.refresh();
                });
              }}
            >
              {pending ? "Emitindo…" : "Emitir insucesso"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type RetornoFisicoProps = {
  chave: string;
  label: string;
};

export function NfeRetornoFisicoButton({ chave, label }: RetornoFisicoProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 text-teal-600 bg-teal-500/10 hover:bg-teal-500/20 hover:text-teal-500 ring-1 ring-teal-500/30"
        aria-label={`Emitir retorno físico da remessa ${label}`}
        title="Emitir retorno físico desta remessa"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Truck className="size-3.5" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Emitir retorno físico da remessa {label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Será emitida NF-e `RETORNO_FISICO` (entrada) referenciando esta remessa e o saldo
              disponível será consumido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-[13px] text-destructive px-1">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  const result = await emitirRetornoFisicoAction(chave);
                  if (result.error) {
                    setError(result.error);
                    return;
                  }
                  setOpen(false);
                  router.refresh();
                });
              }}
            >
              {pending ? "Emitindo…" : "Emitir retorno físico"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
