import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { getAuthMe } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const me = await getAuthMe();
  if (!me) {
    redirect("/login?session=expired");
  }
  if (!me.emailVerified) {
    redirect("/login/verificar-email");
  }
  if (!me.needsOnboarding && me.tenant) {
    redirect("/");
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-y-auto bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 brand-grid-bg opacity-30" aria-hidden />
      <header className="relative z-10 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur-sm sm:px-6 sm:py-4">
        <BrandLogo variant="compact" href="/onboarding/empresa" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-accent sm:text-[12px]">
          Cadastro da empresa
        </span>
      </header>
      <main className="relative z-10 flex-1 min-h-0 overflow-y-auto">{children}</main>
    </div>
  );
}
