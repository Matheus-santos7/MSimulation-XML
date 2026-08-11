import { BrandLogo } from "@/components/brand-logo";
import { LoginPanel } from "@/components/auth/login-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { BRAND } from "@/lib/brand";

/**
 * Página de entrada (login/registro). O shell é Server Component;
 * o painel interativo permanece em `LoginPanel` (client).
 */
export default function LoginPage() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-y-auto bg-background text-foreground px-6 py-10 sm:py-14">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="absolute inset-0 brand-glow-orb opacity-90 pointer-events-none" aria-hidden />
      <div className="absolute inset-0 brand-grid-bg opacity-25 pointer-events-none" aria-hidden />

      <div className="relative w-full max-w-5xl flex flex-col lg:flex-row lg:items-center gap-12 lg:gap-20 xl:gap-24">
        <aside className="hidden lg:flex flex-1 flex-col gap-10 min-w-0">
          <BrandLogo variant="hero" href="/login" className="items-start text-left" />

          <p className="text-muted-foreground text-base leading-relaxed max-w-md">
            {BRAND.description}
          </p>

          <ol className="space-y-4 text-sm text-muted-foreground max-w-sm">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent">
                1
              </span>
              <span>
                <strong className="text-foreground font-medium">Entrar ou criar conta</strong>
                <span className="block mt-0.5 text-muted-foreground/90">
                  Acesso ao ambiente de simulação
                </span>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-xml/15 text-[11px] font-semibold text-brand-xml">
                2
              </span>
              <span>
                <strong className="text-foreground font-medium">Cadastrar empresa emitente</strong>
                <span className="block mt-0.5 text-muted-foreground/90">
                  Dados fiscais e regras tributárias
                </span>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-success/15 text-[11px] font-semibold text-success">
                3
              </span>
              <span>
                <strong className="text-foreground font-medium">Simular NF-e, eventos e CT-e</strong>
                <span className="block mt-0.5 text-muted-foreground/90">
                  Cenários de fulfillment sem SEFAZ
                </span>
              </span>
            </li>
          </ol>
        </aside>

        <main className="w-full max-w-md mx-auto lg:mx-0 lg:shrink-0">
          <div className="lg:hidden flex justify-center mb-10">
            <BrandLogo variant="compact" href="/login" />
          </div>
          <LoginPanel />
        </main>
      </div>
    </div>
  );
}
