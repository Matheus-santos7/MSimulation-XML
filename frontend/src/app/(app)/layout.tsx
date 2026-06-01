import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getAuthMe } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getAuthMe();
  if (!me) {
    redirect("/login?session=expired");
  }
  if (me.needsOnboarding || !me.tenant) {
    redirect("/onboarding/empresa");
  }

  return (
    <AppShell tenant={me.tenant} userEmail={me.email} userName={me.name}>
      {children}
    </AppShell>
  );
}
