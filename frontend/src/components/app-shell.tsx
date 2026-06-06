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
  ShieldCheck,
  Settings2,
  Users,
} from "lucide-react";
import { AccountMenu } from "@/components/auth/account-menu";
import { BrandLogo } from "@/components/brand-logo";
import { BRAND } from "@/lib/brand";
import type { TenantDto } from "@/lib/fiscal-types";

const NAV_OPERACIONAL = [
  { href: "/empresas", label: "Empresas", icon: Building2 },
  { href: "/produtos", label: "Produtos", icon: Package },
  { href: "/pedidos", label: "Pedidos", icon: ShoppingCart },
  { href: "/operacoes", label: "Operações", icon: PackageCheck },
  { href: "/nfe", label: "NF-e Emitidas", icon: FileText },
  { href: "/cte", label: "CT-e Transportes", icon: Truck },
  { href: "/unidades-logisticas", label: "Unidades ML", icon: Warehouse },
] as const;

const NAV_CONFIG = [
  { href: "/usuarios", label: "Usuários", icon: Users },
  { href: "/configuracoes-fiscais", label: "Config. fiscais", icon: Settings2 },
  { href: "/regras", label: "Regras Tributárias", icon: Scale },
  { href: "/auditoria", label: "Auditoria", icon: ShieldCheck },
  { href: "/eventos", label: "Eventos", icon: Bell },
  { href: "/ia", label: "IA Insights", icon: Sparkles },
] as const;

function ambienteLabel(a: TenantDto["ambiente"]): string {
  return a === "PRODUCAO" ? "PRODUÇÃO" : "HOMOLOGAÇÃO";
}

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

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground text-[15px]">
      <aside className="w-64 shrink-0 border-r border-border flex flex-col bg-sidebar">
        <div className="p-4 border-b border-border">
          <BrandLogo variant="full" href="/" />
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          <Link
            href="/"
            className={`flex items-center gap-3 px-3 py-2 rounded transition-colors ${
              path === "/" ? "bg-white/5 text-foreground" : "text-muted-foreground hover:bg-white/5"
            }`}
          >
            <span className="size-1.5 rounded-full bg-success" />
            <span className="font-medium">Dashboard</span>
          </Link>

          <div className="px-3 pt-4 pb-2 text-[12px] font-bold text-muted-foreground uppercase tracking-widest">
            Operacional
          </div>
          {NAV_OPERACIONAL.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded transition-colors ${
                  active
                    ? "bg-accent/5 text-accent font-medium"
                    : "text-muted-foreground hover:bg-white/5"
                }`}
              >
                <Icon className="size-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="px-3 pt-6 pb-2 text-[12px] font-bold text-muted-foreground uppercase tracking-widest">
            Configuração
          </div>
          {NAV_CONFIG.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded transition-colors ${
                  active
                    ? "bg-accent/5 text-accent font-medium"
                    : "text-muted-foreground hover:bg-white/5"
                }`}
              >
                <Icon className="size-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-14 shrink-0 border-b border-border flex items-center justify-between px-6 bg-background/80 backdrop-blur">
          <div className="flex items-center gap-4 min-w-0">
            <span className="font-medium truncate max-w-[min(100%,360px)]">
              {tenant?.razaoSocial ?? "Empresa"}
            </span>
          </div>
          <AccountMenu tenant={tenant} userEmail={userEmail} userName={userName} />
        </header>

        <div className="flex-1 overflow-y-auto">{children}</div>

        <footer className="h-10 shrink-0 border-t border-border bg-accent/5 flex items-center justify-center gap-3 px-4">
          <BrandLogo variant="mark" href="/" className="opacity-80 hover:opacity-100 transition-opacity" />
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            {BRAND.tagline}
          </span>
          <span className="text-[11px] text-muted-foreground hidden md:inline">·</span>
          <span className="text-[11px] font-mono text-muted-foreground hidden md:inline">
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
        <div className="flex h-screen w-full items-center justify-center bg-background text-muted-foreground" />
      }
    >
      <AppShellInner tenant={tenant} userEmail={userEmail} userName={userName}>
        {children}
      </AppShellInner>
    </Suspense>
  );
}
