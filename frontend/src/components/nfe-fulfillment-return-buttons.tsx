"use client";

import { ClipboardCheck, PackageMinus, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  carregarSaldoConferenciaAction,
  emitirConferenciaRemessaAction,
  emitirInsucessoAction,
  emitirRetornoFisicoAction,
} from "@/app/(app)/nfe/actions";
import { NfeActionMenuItem } from "@/components/nfe-action-menu-item";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type InsucessoProps = {
  chave: string;
  label: string;
  disabled?: boolean;
  asMenuItem?: boolean;
};

export function NfeInsucessoButton({ chave, label, disabled, asMenuItem }: InsucessoProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openDialog() {
    setError(null);
    setOpen(true);
  }

  return (
    <>
      {asMenuItem ? (
        <NfeActionMenuItem
          icon={PackageMinus}
          label="Insucesso de entrega"
          disabled={disabled}
          title={disabled ? "Já possui devolução/insucesso" : "Emitir insucesso de entrega"}
          onSelect={openDialog}
        />
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          aria-label={`Emitir insucesso de entrega da venda ${label}`}
          title={disabled ? "Já possui devolução/insucesso" : "Emitir insucesso de entrega"}
          disabled={disabled}
          onClick={openDialog}
        >
          <PackageMinus className="size-3.5" />
        </Button>
      )}
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
  asMenuItem?: boolean;
};

export function NfeRetornoFisicoButton({ chave, label, asMenuItem }: RetornoFisicoProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openDialog() {
    setError(null);
    setOpen(true);
  }

  return (
    <>
      {asMenuItem ? (
        <NfeActionMenuItem
          icon={Truck}
          label="Retorno físico"
          title="Emitir retorno físico desta remessa"
          onSelect={openDialog}
        />
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          aria-label={`Emitir retorno físico da remessa ${label}`}
          title="Emitir retorno físico desta remessa"
          onClick={openDialog}
        >
          <Truck className="size-3.5" />
        </Button>
      )}
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

type ConferenciaProps = {
  chave: string;
  label: string;
  asMenuItem?: boolean;
};

export function NfeConferenciaButton({ chave, label, asMenuItem }: ConferenciaProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [expectedQty, setExpectedQty] = useState<number | null>(null);
  const [receivedQty, setReceivedQty] = useState("");
  const [loadingExpected, setLoadingExpected] = useState(false);
  const [pending, startTransition] = useTransition();

  function openDialog() {
    setError(null);
    setInfo(null);
    setExpectedQty(null);
    setReceivedQty("");
    setOpen(true);
    setLoadingExpected(true);
    void carregarSaldoConferenciaAction(chave).then((result) => {
      setLoadingExpected(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.expectedQty != null) {
        setExpectedQty(result.expectedQty);
        setReceivedQty(String(result.expectedQty));
      }
    });
  }

  return (
    <>
      {asMenuItem ? (
        <NfeActionMenuItem
          icon={ClipboardCheck}
          label="Conferência"
          title="Conferência INBOUND (diferença POSITIVE/NEGATIVE)"
          onSelect={openDialog}
        />
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          aria-label={`Conferência da remessa ${label}`}
          title="Conferência INBOUND (diferença POSITIVE/NEGATIVE)"
          onClick={openDialog}
        >
          <ClipboardCheck className="size-3.5" />
        </Button>
      )}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferência da remessa {label}</AlertDialogTitle>
            <AlertDialogDescription>
              Informe a quantidade recebida. O esperado é o saldo lógico atual (pai + sobras
              POSITIVE). Sem diferença → nada emite. Falta → NF NEGATIVE; sobra → NF POSITIVE.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2 px-1">
            <p className="text-[13px] text-muted-foreground">
              {loadingExpected
                ? "Carregando esperado…"
                : expectedQty != null
                  ? `Esperado (saldo lógico): ${expectedQty}`
                  : "Esperado indisponível"}
            </p>
            <Label htmlFor={`conf-qty-${chave}`}>Quantidade recebida</Label>
            <Input
              id={`conf-qty-${chave}`}
              type="number"
              min={0}
              step="any"
              value={receivedQty}
              onChange={(e) => setReceivedQty(e.target.value)}
              disabled={pending || loadingExpected}
            />
          </div>
          {error && <p className="text-[13px] text-destructive px-1">{error}</p>}
          {info && <p className="text-[13px] text-muted-foreground px-1">{info}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending || loadingExpected || receivedQty.trim() === ""}
              onClick={(e) => {
                e.preventDefault();
                const qty = Number(receivedQty);
                if (!Number.isFinite(qty) || qty < 0) {
                  setError("Quantidade inválida.");
                  return;
                }
                startTransition(async () => {
                  const result = await emitirConferenciaRemessaAction(chave, qty);
                  if (result.error) {
                    setError(result.error);
                    return;
                  }
                  if (result.noop) {
                    setInfo(
                      `Sem diferença (esperado ${result.expectedQty}). Nenhuma NF emitida.`,
                    );
                    return;
                  }
                  setOpen(false);
                  router.refresh();
                });
              }}
            >
              {pending ? "Conferindo…" : "Confirmar conferência"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
