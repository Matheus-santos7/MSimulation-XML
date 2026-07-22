import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { authSurfaceClass } from "@/lib/ui/shell-styles";

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
    <div className="relative min-h-dvh flex items-center justify-center bg-background px-6 py-10">
      <div className="absolute inset-0 brand-glow-orb opacity-80 pointer-events-none" aria-hidden />
      <div className="relative w-full max-w-md space-y-10">
        <div className="flex justify-center">
          <BrandLogo variant="compact" href="/login" />
        </div>
        <div className={authSurfaceClass()}>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {description ? (
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{description}</p>
            ) : null}
          </div>
          {children}
          {showBackToLogin ? (
            <p className="text-center text-sm text-muted-foreground">
              <Link href="/login" className="text-accent hover:underline underline-offset-4">
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
