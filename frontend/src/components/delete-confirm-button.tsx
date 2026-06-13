"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { excluirCteAction } from "@/app/(app)/cte/actions";
import { excluirNfeAction } from "@/app/(app)/nfe/actions";
import { excluirPedidoAction } from "@/app/(app)/pedidos/actions";
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
import type { PedidoDto } from "@/lib/fiscal-types";

type DeleteConfirmConfig = {
  ariaLabel: string;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  onConfirm: () => Promise<{ error?: string }>;
};

type FiscalVariantProps = {
  variant: "nfe" | "cte";
  chave: string;
  label: string;
  className?: string;
};

type PedidoVariantProps = {
  variant: "pedido";
  pedido: PedidoDto;
  className?: string;
};

type Props = FiscalVariantProps | PedidoVariantProps;

function buildFiscalConfig(variant: "nfe" | "cte", chave: string, label: string): DeleteConfirmConfig {
  const docLabel = variant === "nfe" ? "NF-e" : "CT-e";

  return {
    ariaLabel: `Remover ${docLabel} ${label}`,
    title: `Remover ${docLabel} da lista?`,
    confirmLabel: "Remover",
    pendingLabel: "Removendo…",
    description: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          O documento <strong className="text-foreground">{label}</strong> deixará de aparecer na listagem.
        </p>
        <p>
          Os dados permanecem no banco para auditoria e histórico fiscal. Esta ação não cancela o documento na
          SEFAZ.
        </p>
      </div>
    ),
    onConfirm: () => (variant === "nfe" ? excluirNfeAction(chave) : excluirCteAction(chave)),
  };
}

function buildPedidoConfig(pedido: PedidoDto): DeleteConfirmConfig | null {
  if (!pedido.excluivel) return null;

  const isFaturado = pedido.status === "FATURADO";
  const label = pedido.pedidoMl ?? `RASC-${pedido.id.slice(0, 8)}`;

  return {
    ariaLabel: `Excluir pedido ${label}`,
    title: isFaturado ? "Remover pedido faturado?" : "Excluir pedido?",
    confirmLabel: "Excluir",
    pendingLabel: "Excluindo…",
    description: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          O pedido de <strong className="text-foreground">{pedido.comprador.nome}</strong> ({label}) será
          removido da lista.
        </p>
        {isFaturado && pedido.nfe ? (
          <p>
            A NF-e{" "}
            <strong className="text-foreground font-mono">
              {pedido.nfe.numero}/{pedido.nfe.serie}
            </strong>{" "}
            permanece emitida. A numeração não será reutilizada e o pedido não poderá ser editado novamente.
          </p>
        ) : (
          <p>Rascunhos excluídos não geram NF-e.</p>
        )}
      </div>
    ),
    onConfirm: () => excluirPedidoAction(pedido.id),
  };
}

function resolveConfig(props: Props): DeleteConfirmConfig | null {
  if (props.variant === "pedido") return buildPedidoConfig(props.pedido);
  return buildFiscalConfig(props.variant, props.chave, props.label);
}

export function DeleteConfirmButton(props: Props) {
  const config = resolveConfig(props);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!config) return null;

  const { ariaLabel, title, description, confirmLabel, pendingLabel, onConfirm } = config;
  const className = props.className ?? "size-8 text-muted-foreground hover:text-destructive";

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={className}
        aria-label={ariaLabel}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Trash2 className="size-3.5" />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription asChild>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-[13px] text-destructive px-1">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                startTransition(async () => {
                  const result = await onConfirm();
                  if (result.error) {
                    setError(result.error);
                    return;
                  }
                  setOpen(false);
                  router.refresh();
                })
              }
            >
              {pending ? pendingLabel : confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
