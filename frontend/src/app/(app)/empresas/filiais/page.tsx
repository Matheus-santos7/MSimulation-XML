import { redirect } from "next/navigation";

/** Redireciona para gestão unificada em /empresas. */
export default function FiliaisRedirectPage() {
  redirect("/empresas");
}
