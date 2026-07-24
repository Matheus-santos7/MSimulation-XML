"use client";

import type { LucideIcon } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Props = {
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  title?: string;
  /** Cancelar / remover — único tom colorido (vermelho). */
  destructive?: boolean;
  onSelect: () => void;
};

/** Item padrão do menu ⋮ de ações da NF-e (ícone + título). */
export function NfeActionMenuItem({
  icon: Icon,
  label,
  disabled,
  title,
  destructive,
  onSelect,
}: Props) {
  return (
    <DropdownMenuItem
      disabled={disabled}
      title={title}
      className={cn(
        "cursor-pointer gap-2",
        destructive && "text-destructive focus:text-destructive focus:bg-destructive/10",
      )}
      onSelect={(e) => {
        // Mantém o foco estável ao abrir o AlertDialog em seguida.
        e.preventDefault();
        onSelect();
      }}
    >
      <Icon className="size-4 shrink-0" />
      <span>{label}</span>
    </DropdownMenuItem>
  );
}
