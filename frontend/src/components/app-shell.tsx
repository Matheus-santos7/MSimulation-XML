"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import {
  Building2,
  Package,
  ShoppingCart,
  FileText,
  Truck,
  Warehouse,
  PackageCheck,
  Scale,
  Bell,
  Sparkles,
  Settings2,
  Users,
} from "lucide-react";
import { AccountMenu } from "@/components/account/account-menu";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  shellNavLinkClass,
  shellNavSectionLabelClass,
} from "@/lib/ui/shell-styles";
import { cn } from "@/lib/utils";
import type { TenantDto } from "@/lib/fiscal-types";

/** Rotas que preenchem a área útil — scroll só dentro do conteúdo, nunca no browser. */
const PAGE_FILL_PATHS = new Set(["/", "/nfe"]);

const NAV_OPERACIONAL = [
  { href: "/empresas", label: "Empresas", icon: Building2 },
  { href: "/produtos", label: "Produtos", icon: Package },
  { href: "/operacoes", label: "Remessas", icon: PackageCheck },
  { href: "/pedidos", label: "Pedidos", icon: ShoppingCart },
  { href: "/nfe", label: "NF-e Emitidas", icon: FileText },
  { href: "/cte", label: "CT-e Transportes", icon: Truck },
  { href: "/eventos", label: "Eventos", icon: Bell },
] as const;

const NAV_CONFIG = [
  { href: "/regras", label: "Regras Tributárias", icon: Scale },
  { href: "/unidades-logisticas", label: "Unidades ML", icon: Warehouse },
  { href: "/configuracoes-fiscais", label: "Config. fiscais", icon: Settings2 },
  { href: "/usuarios", label: "Usuários", icon: Users },
  { href: "/ia", label: "IA Insights", icon: Sparkles },
] as const;

function AppShellInner({
  tenant,
  userEmail,
  userName,
  children,
}: {
  tenant?: TenantDto;
  userEmail?: string;
  userName?: string;
  children: React.ReactNode;
}) {
  const path = usePathname() ?? "/";
  const isActive = (href: string) => path === href || (href !== "/" && path.startsWith(href));
  const isPageFill = PAGE_FILL_PATHS.has(path);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground text-[15px]">
      <aside className="w-64 shrink-0 border-r border-border/80 flex flex-col bg-sidebar">
        <div className="px-4 py-5 border-b border-border/80">
          <BrandLogo variant="full" href="/" />
        </div>

        <nav className="flex-1 px-3 py-3 space-y-1 overflow-hidden">
          <Link href="/" className={shellNavLinkClass(path === "/")}>
            <span className="size-1.5 rounded-full bg-success shrink-0" />
            <span className="font-medium">Dashboard</span>
          </Link>

          <div className={shellNavSectionLabelClass()}>Operacional</div>
          {NAV_OPERACIONAL.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href} className={shellNavLinkClass(active)}>
                <Icon className="size-4 shrink-0 opacity-80" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className={shellNavSectionLabelClass()}>Configuração</div>
          {NAV_CONFIG.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href} className={shellNavLinkClass(active)}>
                <Icon className="size-4 shrink-0 opacity-80" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-16 shrink-0 border-b border-border/80 flex items-center justify-between px-6 lg:px-8 bg-background/90 backdrop-blur-md">
          <div className="flex items-center gap-4 min-w-0">
            <span className="font-medium truncate max-w-[min(100%,360px)]">
              {tenant?.razaoSocial ?? "Empresa"}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <AccountMenu tenant={tenant} userEmail={userEmail} userName={userName} />
          </div>
        </header>

        <div
          className={cn(
            "flex flex-1 min-h-0 flex-col",
            isPageFill ? "overflow-hidden" : "overflow-y-auto",
          )}
        >
          {children}
        </div>

        <footer className="h-11 shrink-0 border-t border-border/80 bg-muted/30 flex items-center justify-center px-4">
          <span className="text-[11px] font-mono text-muted-foreground">
            Simulação — sem validade SEFAZ
          </span>
        </footer>
      </main>
    </div>
  );
}

export function AppShell({
  tenant,
  userEmail,
  userName,
  children,
}: {
  tenant?: TenantDto;
  userEmail?: string;
  userName?: string;
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh w-full items-center justify-center bg-background text-muted-foreground" />
      }
    >
      <AppShellInner tenant={tenant} userEmail={userEmail} userName={userName}>
        {children}
      </AppShellInner>
    </Suspense>
  );
}
