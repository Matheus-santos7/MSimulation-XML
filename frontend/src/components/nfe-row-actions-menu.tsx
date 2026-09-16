"use client";

import { MoreHorizontal } from "lucide-react";
import { useRef, useState } from "react";
import { DeleteConfirmButton } from "@/components/delete-confirm-button";
import { NfeCancelarButton } from "@/components/nfe-cancelar-button";
import { NfeDevolucaoDialog, NfeDevolucaoMenuItem } from "@/components/nfe-devolucao-button";
import {
  NfeConferenciaButton,
  NfeInsucessoButton,
  NfeRetornoFisicoButton,
} from "@/components/nfe-fulfillment-return-buttons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type NfeRowActionsMenuProps = {
  chave: string;
  label: string;
  tipo: string;
  status: string;
  saldoDisponivel?: number | null;
  vendaCancelDisabled?: boolean;
  vendaCancelReason?: string;
  /** Venda sem saldo a devolver (integralmente devolvida ou cancelada). */
  vendaJaDevolvida?: boolean;
  /** Venda com devolução parcial emitida — ainda há itens a devolver. */
  vendaDevolucaoParcial?: boolean;
  /** Venda com qualquer devolução/insucesso emitido (bloqueia insucesso). */
  vendaComDevolucao?: boolean;
};

/**
 * Menu ⋮ da lista de NF-e — concentra ações com ícone + título.
 * Só cancelar/remover usam vermelho; demais itens ficam neutros.
 */
export function NfeRowActionsMenu({
  chave,
  label,
  tipo,
  status,
  saldoDisponivel,
  vendaCancelDisabled,
  vendaCancelReason,
  vendaJaDevolvida,
  vendaDevolucaoParcial,
  vendaComDevolucao,
}: NfeRowActionsMenuProps) {
  const isVenda = tipo === "VENDA";
  const isRemessa =
    (tipo === "REMESSA" || tipo === "REMESSA_AVANCO") && status === "AUTORIZADA";
  const showRetornoFisico = isRemessa && (saldoDisponivel ?? 0) > 0;
  const [devolucaoOpen, setDevolucaoOpen] = useState(false);
  const openingDevolucao = useRef(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            aria-label={`Ações da NF-e ${label}`}
            title="Ações"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-52"
          onCloseAutoFocus={(event) => {
            if (!openingDevolucao.current) return;
            event.preventDefault();
            openingDevolucao.current = false;
          }}
        >
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Ações · {label}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {isVenda && (
            <>
              <NfeCancelarButton
                asMenuItem
                chave={chave}
                label={label}
                desabilitado={vendaCancelDisabled}
                motivoDesabilitado={vendaCancelReason}
              />
              <NfeDevolucaoMenuItem
                jaDevolvida={vendaJaDevolvida}
                parcial={vendaDevolucaoParcial}
                onSelect={() => {
                  openingDevolucao.current = true;
                  setDevolucaoOpen(true);
                }}
              />
              <NfeInsucessoButton
                asMenuItem
                chave={chave}
                label={label}
                disabled={vendaJaDevolvida || vendaComDevolucao}
              />
              <DropdownMenuSeparator />
            </>
          )}

          {isRemessa && (
            <>
              <NfeConferenciaButton asMenuItem chave={chave} label={label} />
              {showRetornoFisico && (
                <NfeRetornoFisicoButton asMenuItem chave={chave} label={label} />
              )}
              <DropdownMenuSeparator />
            </>
          )}

          <DeleteConfirmButton asMenuItem variant="nfe" chave={chave} label={label} />
        </DropdownMenuContent>
      </DropdownMenu>

      {isVenda && (
        <NfeDevolucaoDialog
          open={devolucaoOpen}
          onOpenChange={setDevolucaoOpen}
          chave={chave}
          label={label}
        />
      )}
    </>
  );
}
