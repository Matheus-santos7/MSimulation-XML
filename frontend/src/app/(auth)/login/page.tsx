"use client";

import { BrandLogo } from "@/components/brand-logo";
import { LoginPanel } from "@/components/auth/login-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { BRAND } from "@/lib/brand";

export default function LoginPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background text-foreground p-6 overflow-hidden">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="absolute inset-0 brand-grid-bg opacity-40 pointer-events-none" aria-hidden />

      <div className="relative w-full max-w-5xl flex flex-col lg:flex-row lg:items-center gap-10 lg:gap-16 xl:gap-20">
        <aside className="hidden lg:flex flex-1 flex-col gap-8 min-w-0">
          <BrandLogo variant="hero" href="/login" className="items-start text-left" />

          <p className="text-muted-foreground text-[15px] leading-relaxed max-w-md">
            {BRAND.description}
          </p>

          <ul className="space-y-3 text-[13px] text-muted-foreground max-w-sm">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 rounded-full bg-accent shrink-0" />
              <span>
                <strong className="text-foreground">Passo 1</strong> — Entrar ou criar conta
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 rounded-full bg-brand-xml shrink-0" />
              <span>
                <strong className="text-foreground">Passo 2</strong> — Cadastrar empresa emitente
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 rounded-full bg-success shrink-0" />
              <span>
                <strong className="text-foreground">Passo 3</strong> — Simular NF-e, Eventos fiscais e CT-e.
              </span>
            </li>
          </ul>

          {/* <footer className="text-[11px] text-muted-foreground">
            <span className="font-mono text-accent/80">{BRAND.fullName}</span>
            <span className="mx-2 opacity-40">·</span>
            <span>{BRAND.author}</span>
          </footer> */}
        </aside>

        <main className="w-full max-w-md mx-auto lg:mx-0 lg:shrink-0">
          <div className="lg:hidden flex justify-center mb-8">
            <BrandLogo variant="compact" href="/login" />
          </div>
          <LoginPanel />
        </main>
      </div>
    </div>
  );
}
