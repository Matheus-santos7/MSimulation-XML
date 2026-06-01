"use client";

import { BrandLogo } from "@/components/brand-logo";
import { LoginPanel } from "@/components/auth/login-panel";
import { BRAND } from "@/lib/brand";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="hidden lg:flex lg:w-[min(480px,42vw)] relative flex-col justify-between border-r border-border overflow-hidden">
        <div className="absolute inset-0 brand-grid-bg opacity-60" aria-hidden />
        <div className="absolute inset-0 brand-glow-orb" aria-hidden />

        <div className="relative p-10 pt-12 flex flex-col gap-8">
          <BrandLogo variant="hero" href="/login" className="items-center text-center" />

          <p className="text-muted-foreground text-[15px] leading-relaxed max-w-sm mx-auto text-center">
            {BRAND.description}
          </p>

          <ul className="space-y-3 text-[13px] text-muted-foreground max-w-xs mx-auto">
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
                <strong className="text-foreground">Passo 3</strong> — Simular NF-e, CT-e e fulfillment
              </span>
            </li>
          </ul>
        </div>

        <footer className="relative px-10 pb-8 text-[11px] text-muted-foreground">
          <span className="font-mono text-accent/80">{BRAND.fullName}</span>
          <span className="mx-2 opacity-40">·</span>
          <span>{BRAND.author}</span>
        </footer>
      </aside>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex justify-center">
            <BrandLogo variant="compact" href="/login" />
          </div>
          <LoginPanel />
        </div>
      </main>
    </div>
  );
}
