"use client";

import Link from "next/link";
import { Building2, ChevronDown, KeyRound, LogOut, UserCircle2 } from "lucide-react";
import { logoutAction } from "@/lib/auth/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TenantDto } from "@/lib/fiscal-types";
import { cn } from "@/lib/utils";

function displayName(userName?: string, userEmail?: string): string {
  if (userName?.trim()) return userName.trim();
  if (userEmail) return userEmail.split("@")[0] ?? userEmail;
  return "Conta";
}

function initials(userName?: string, userEmail?: string): string {
  const base = displayName(userName, userEmail);
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

function ambienteLabel(a: TenantDto["ambiente"]): string {
  return a === "PRODUCAO" ? "Produção" : "Homologação";
}

type Props = {
  tenant?: TenantDto;
  userEmail?: string;
  userName?: string;
};

export function AccountMenu({ tenant, userEmail, userName }: Props) {
  const name = displayName(userName, userEmail);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5",
          "text-[13px] text-foreground hover:bg-white/5 transition-colors",
          "outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        )}
      >
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent text-[11px] font-bold"
          aria-hidden
        >
          {initials(userName, userEmail)}
        </span>
        <span className="hidden sm:flex flex-col items-start max-w-[180px] leading-tight">
          <span className="font-medium truncate w-full">{name}</span>
          {tenant ? (
            <span className="text-[11px] text-muted-foreground truncate w-full">
              {tenant.razaoSocial}
            </span>
          ) : null}
        </span>
        <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal space-y-1 py-2">
          <p className="text-sm font-medium text-foreground truncate">{name}</p>
          {userEmail ? (
            <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
          ) : null}
          {tenant ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
              <Building2 className="size-3 shrink-0" />
              <span className="truncate">{tenant.razaoSocial}</span>
              <span className="text-[10px] uppercase tracking-wide text-accent shrink-0">
                {ambienteLabel(tenant.ambiente)}
              </span>
            </p>
          ) : null}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/conta" className="cursor-pointer">
            <UserCircle2 />
            Minha conta
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/conta/seguranca" className="cursor-pointer">
            <KeyRound />
            Segurança
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
          <form action={logoutAction} className="w-full">
            <button
              type="submit"
              className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none hover:bg-destructive/10 focus:bg-destructive/10"
            >
              <LogOut className="size-4" />
              Sair da empresa
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
