import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";

type AuthCardShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
  /** Conteúdo abaixo do card (ex.: link “Voltar ao login”). */
  footer?: ReactNode;
  /** Quando false, omite o link padrão de retorno ao login. */
  showBackToLogin?: boolean;
};

/**
 * Shell visual compartilhado das subrotas de `/login/*`
 * (logo compacto, card centralizado e rodapé opcional).
 */
export function AuthCardShell({
  title,
  description,
  children,
  footer,
  showBackToLogin = true,
}: AuthCardShellProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-center">
          <BrandLogo variant="compact" href="/login" />
        </div>
        <div className="border border-border rounded-xl bg-card/50 backdrop-blur-sm p-8 space-y-6 shadow-[0_0_40px_-12px_oklch(0.769_0.166_70.5_/_0.15)]">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            {description ? (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            ) : null}
          </div>
          {children}
          {showBackToLogin ? (
            <p className="text-center text-sm text-muted-foreground">
              <Link href="/login" className="text-accent hover:underline">
                Voltar ao login
              </Link>
            </p>
          ) : null}
          {footer}
        </div>
      </div>
    </div>
  );
}
