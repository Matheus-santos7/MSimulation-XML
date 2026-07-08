import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProductDto } from "@/lib/fiscal-types";
import type { PedidoItemFormValues } from "@/lib/pedido-form-types";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PEDIDO_WIZARD_PANEL_CLASS, PEDIDO_WIZARD_SELECT_CLASS } from "./pedido-wizard-styles";

type LineTotal = {
  product?: ProductDto;
  qty: number;
  total: number;
};

type Props = {
  items: PedidoItemFormValues[];
  products: ProductDto[];
  lineTotals: LineTotal[];
  onItemChange: (index: number, key: keyof PedidoItemFormValues, value: string) => void;
  onRemoveItem: (index: number) => void;
};

const MONEY_INPUT = "h-9 bg-background font-mono text-[13px] tabular-nums";

/**
 * Lista de itens em cards — escala melhor com vários produtos que layout tabular.
 */
export function PedidoWizardItemsTable({
  items,
  products,
  lineTotals,
  onItemChange,
  onRemoveItem,
}: Props) {
  const scrollable = items.length > 1;

  return (
    <div
      className={cn(
        "space-y-3",
        scrollable && "max-h-[min(26rem,calc(90vh-18rem))] overflow-y-auto pr-1 -mr-1",
      )}
    >
      {items.map((item, index) => {
        const line = lineTotals[index];
        return (
          <article
            key={index}
            className={`${PEDIDO_WIZARD_PANEL_CLASS} p-4 space-y-3`}
          >
            <header className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Item {index + 1}
                </p>
                <p className="mt-0.5 text-[12px] text-muted-foreground truncate">
                  {line?.qty ?? 1} × {brl(line?.product?.preco ?? 0)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-[14px] font-semibold tabular-nums text-foreground">
                  {brl(line?.total ?? 0)}
                </span>
                {items.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={() => onRemoveItem(index)}
                    title="Remover item"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : null}
              </div>
            </header>

            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">Produto</Label>
              <select
                value={item.productId}
                onChange={(e) => onItemChange(index, "productId", e.target.value)}
                className={PEDIDO_WIZARD_SELECT_CLASS}
                required
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground">Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  value={item.quantidade}
                  onChange={(e) => onItemChange(index, "quantidade", e.target.value)}
                  className={MONEY_INPUT}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground">Desconto</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  inputMode="decimal"
                  value={item.desconto}
                  onChange={(e) => onItemChange(index, "desconto", e.target.value)}
                  className={MONEY_INPUT}
                />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
