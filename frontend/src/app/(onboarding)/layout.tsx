import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { getAuthMe } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const me = await getAuthMe();
  if (!me) {
    redirect("/login?session=expired");
  }
  if (!me.needsOnboarding && me.tenant) {
    redirect("/");
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <BrandLogo variant="compact" href="/onboarding/empresa" />
        <span className="text-[12px] font-bold uppercase tracking-widest text-accent">
          Passo 2 — Empresa
        </span>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
