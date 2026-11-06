import { Skeleton } from "@/components/ui/skeleton";

const TABLE_ROWS = 8;
const TABLE_COLUMNS = 6;
const CARD_COUNT = 6;
const PANEL_LINES = 5;

function range(length: number): number[] {
  return Array.from({ length }, (_, index) => index);
}

function SkeletonRegion({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">Carregando…</span>
      {children}
    </div>
  );
}

/** Espelha o `PageHeader`: título + subtítulo (+ ação à direita). */
function PageHeaderSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="mb-6 flex items-end justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {withAction ? <Skeleton className="h-9 w-32" /> : null}
    </div>
  );
}

/** Tela de lista com tabela (NF-e, CT-e, eventos, regras, logística, auditoria). */
export function TablePageSkeleton() {
  return (
    <SkeletonRegion className="p-6">
      <PageHeaderSkeleton />
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex gap-4 border-b border-border bg-muted/30 px-4 py-3">
          {range(TABLE_COLUMNS).map((col) => (
            <Skeleton key={col} className="h-3 flex-1" />
          ))}
        </div>
        <div className="divide-y divide-border">
          {range(TABLE_ROWS).map((row) => (
            <div key={row} className="flex items-center gap-4 px-4 py-3.5">
              {range(TABLE_COLUMNS).map((col) => (
                <Skeleton key={col} className="h-4 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** Tela de lista em cards (produtos, empresas, usuários). */
export function CardGridPageSkeleton({ withToolbar = false }: { withToolbar?: boolean }) {
  return (
    <SkeletonRegion className="space-y-4 p-6">
      <PageHeaderSkeleton withAction />
      {withToolbar ? <Skeleton className="h-[68px] w-full rounded-lg" /> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {range(CARD_COUNT).map((card) => (
          <div key={card} className="space-y-3 rounded-lg border border-border bg-card p-4">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

/** Neutro: cabeçalho + um painel. Serve de fallback, detalhe e formulário. */
export function PageSkeleton() {
  return (
    <SkeletonRegion className="p-6">
      <PageHeaderSkeleton />
      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        {range(PANEL_LINES).map((line) => (
          <Skeleton key={line} className="h-5 w-full" />
        ))}
      </div>
    </SkeletonRegion>
  );
}
