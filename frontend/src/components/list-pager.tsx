import Link from "next/link";
import { PAGE_PARAM } from "@/lib/paginate";

type ListPagerProps = {
  pathname: string;
  /** Demais parâmetros da URL (filtros) que devem sobreviver à troca de página. */
  query: Record<string, string>;
  page: number;
  totalPages: number;
  totalItems: number;
  itemLabel: string;
};

function pageHref(pathname: string, query: Record<string, string>, page: number): string {
  const params = new URLSearchParams(query);
  if (page > 1) params.set(PAGE_PARAM, String(page));
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}

const linkClass = "rounded border border-border px-3 py-1.5 text-sm hover:bg-muted/40";
const disabledClass = "rounded border border-border px-3 py-1.5 text-sm opacity-40";

/** Navegação Anterior / Próxima por links: a página é a URL, sem estado no cliente. */
export function ListPager({ pathname, query, page, totalPages, totalItems, itemLabel }: ListPagerProps) {
  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>
        {totalItems} {itemLabel} · página {page} de {totalPages}
      </span>
      <span className="flex gap-2">
        {page > 1 ? (
          <Link href={pageHref(pathname, query, page - 1)} className={linkClass}>
            Anterior
          </Link>
        ) : (
          <span className={disabledClass}>Anterior</span>
        )}
        {page < totalPages ? (
          <Link href={pageHref(pathname, query, page + 1)} className={linkClass}>
            Próxima
          </Link>
        ) : (
          <span className={disabledClass}>Próxima</span>
        )}
      </span>
    </nav>
  );
}
