import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  steps: readonly string[];
  currentStep: number;
};

/**
 * Stepper horizontal do wizard de pedido com estados ativo, concluído e pendente.
 */
export function PedidoWizardStepper({ steps, currentStep }: Props) {
  return (
    <nav aria-label="Etapas do pedido" className="border-b border-border bg-muted/10 px-5 py-3 sm:px-6">
      <ol className="flex items-center gap-0">
        {steps.map((label, index) => {
          const isDone = index < currentStep;
          const isCurrent = index === currentStep;
          const isLast = index === steps.length - 1;

          return (
            <li key={label} className={cn("flex items-center", !isLast && "flex-1")}>
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-1 ring-inset transition-colors",
                    isCurrent && "bg-accent text-accent-foreground ring-accent/40",
                    isDone && "bg-accent/15 text-accent ring-accent/25",
                    !isCurrent && !isDone && "bg-muted text-muted-foreground ring-border",
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isDone ? <Check className="size-3.5" strokeWidth={2.5} /> : index + 1}
                </span>
                <span
                  className={cn(
                    "hidden truncate text-[12px] font-semibold sm:block",
                    isCurrent ? "text-foreground" : isDone ? "text-muted-foreground" : "text-muted-foreground/60",
                  )}
                >
                  {label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "mx-2 h-px flex-1 min-w-[1rem]",
                    isDone ? "bg-accent/40" : "bg-border",
                  )}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
