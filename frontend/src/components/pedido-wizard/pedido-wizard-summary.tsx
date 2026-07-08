import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { PedidoFormExample } from "@/lib/pedido-form";
import { PEDIDO_FORM_EXAMPLE_GROUPS, PEDIDO_FORM_EXAMPLES } from "@/lib/pedido-form";
import { PEDIDO_WIZARD_PANEL_CLASS, PEDIDO_WIZARD_SELECT_CLASS } from "./pedido-wizard-styles";

type BuyerExampleProps = {
  exampleId: string;
  selectedExample?: PedidoFormExample;
  onExampleChange: (id: string) => void;
  onReloadExample?: () => void;
};

/** Seleção de comprador por exemplo fiscal — etapa do comprador. */
export function PedidoWizardBuyerExamplePanel({
  exampleId,
  selectedExample,
  onExampleChange,
  onReloadExample,
}: BuyerExampleProps) {
  return (
    <div className={`${PEDIDO_WIZARD_PANEL_CLASS} p-4 space-y-3 h-fit lg:sticky lg:top-0`}>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Exemplos</p>
        <p className="mt-1 text-[13px] text-muted-foreground leading-snug">
          Escolha um perfil para preencher comprador e endereço automaticamente.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pedidoExample" className="text-[12px] text-muted-foreground">
          Comprador simulado
        </Label>
        <select
          id="pedidoExample"
          value={exampleId}
          onChange={(e) => onExampleChange(e.target.value)}
          className={PEDIDO_WIZARD_SELECT_CLASS}
        >
          <option value="">Selecione um exemplo…</option>
          {PEDIDO_FORM_EXAMPLE_GROUPS.map((group) => (
            <optgroup key={group.kind} label={group.label}>
              {PEDIDO_FORM_EXAMPLES.filter((item) => item.kind === group.kind).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {selectedExample ? (
        <p className="text-[12px] leading-relaxed text-muted-foreground rounded-md bg-muted/40 px-3 py-2.5">
          {selectedExample.fiscalHint}
        </p>
      ) : (
        <p className="text-[12px] text-muted-foreground">
          Ou preencha os dados do comprador manualmente ao lado.
        </p>
      )}

      {exampleId && onReloadExample ? (
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={onReloadExample}>
          Recarregar exemplo
        </Button>
      ) : null}
    </div>
  );
}
