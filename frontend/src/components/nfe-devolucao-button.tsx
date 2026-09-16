"use client";

import { Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  carregarItensDevolucaoAction,
  devolverVendaAction,
} from "@/app/(app)/nfe/actions";
import { NfeActionMenuItem } from "@/components/nfe-action-menu-item";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { DevolucaoDisponivel, DevolucaoItemInput } from "@/lib/fiscal-api";

type Props = {
  chave: string;
  label: string;
  /** Venda sem saldo a devolver (integralmente devolvida ou cancelada). */
  jaDevolvida?: boolean;
  /** Venda com devolução parcial já emitida — ainda há itens a devolver. */
  parcial?: boolean;
  asMenuItem?: boolean;
};

type Quantidades = Record<number, string>;

function quantidadesIniciais(disponivel: DevolucaoDisponivel): Quantidades {
  const out: Quantidades = {};
  for (const item of disponivel.itens) {
    out[item.numeroItem] = String(item.quantidadeDisponivel);
  }
  return out;
}

/** Converte os inputs em `itens` da API; `null` quando algum valor é inválido. */
function montarItens(
  disponivel: DevolucaoDisponivel,
  quantidades: Quantidades,
): { itens: DevolucaoItemInput[]; total: number } | null {
  const itens: DevolucaoItemInput[] = [];
  let total = 0;
  for (const item of disponivel.itens) {
    const raw = (quantidades[item.numeroItem] ?? "").trim();
    const qty = raw === "" ? 0 : Number(raw);
    if (!Number.isInteger(qty) || qty < 0 || qty > item.quantidadeDisponivel) return null;
    if (qty > 0) {
      itens.push({ numeroItem: item.numeroItem, quantidade: qty });
      total += qty;
    }
  }
  return { itens, total };
}

export function NfeDevolucaoButton({ chave, label, jaDevolvida, parcial, asMenuItem }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [disponivel, setDisponivel] = useState<DevolucaoDisponivel | null>(null);
  const [quantidades, setQuantidades] = useState<Quantidades>({});
  const [pending, startTransition] = useTransition();

  const title = jaDevolvida
    ? "Venda já devolvida"
    : parcial
      ? "Devolver itens restantes desta venda"
      : "Emitir devolução desta venda";

  function openDialog() {
    setError(null);
    setDisponivel(null);
    setQuantidades({});
    setOpen(true);
    setLoading(true);
    void carregarItensDevolucaoAction(chave).then((result) => {
      setLoading(false);
      if (result.error || !result.disponivel) {
        setError(result.error ?? "Não foi possível carregar os itens da venda.");
        return;
      }
      setDisponivel(result.disponivel);
      setQuantidades(quantidadesIniciais(result.disponivel));
    });
  }

  const montado = disponivel ? montarItens(disponivel, quantidades) : null;
  const restante = disponivel?.quantidadeDisponivel ?? 0;
  const devolvendoTudo = montado != null && montado.total === restante;
  const podeEmitir = !pending && !loading && montado != null && montado.total > 0;

  return (
    <>
      {asMenuItem ? (
        <NfeActionMenuItem
          icon={Undo2}
          label={parcial ? "Devolver restante" : "Devolver"}
          disabled={jaDevolvida}
          title={title}
          onSelect={openDialog}
        />
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          aria-label={`Emitir devolução da venda ${label}`}
          title={title}
          disabled={jaDevolvida}
          onClick={openDialog}
        >
          <Undo2 className="size-3.5" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Devolução da venda {label}</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Escolha os itens e quantidades devolvidos. Será emitida uma{" "}
                  <strong className="text-foreground">NF-e de devolução</strong> referenciando esta
                  venda, espelhando os impostos originais na proporção devolvida.
                </p>
                <p>
                  O saldo devolvido retorna às <strong className="text-foreground">remessas</strong>{" "}
                  da cadeia (estorno FIFO) e a reposição ao CD sai como remessa simbólica dos
                  itens devolvidos.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          {loading && <p className="text-[13px] text-muted-foreground">Carregando itens da venda…</p>}

          {disponivel && (
            <div className="space-y-3">
              {disponivel.devolucoes.length > 0 && (
                <p className="text-[13px] text-muted-foreground">
                  Já devolvido: <strong className="text-foreground">{disponivel.quantidadeDevolvida}</strong>{" "}
                  de {disponivel.venda.quantidade} un. em{" "}
                  {disponivel.devolucoes.map((d) => `${d.numero}/${d.serie}`).join(", ")}.
                </p>
              )}

              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-muted/30 text-[12px] uppercase tracking-tighter text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Item</th>
                      <th className="px-3 py-2 font-medium text-right">Vendida</th>
                      <th className="px-3 py-2 font-medium text-right">Devolvida</th>
                      <th className="px-3 py-2 font-medium text-right">Disponível</th>
                      <th className="px-3 py-2 font-medium text-right w-[120px]">Devolver</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {disponivel.itens.map((item) => {
                      const raw = quantidades[item.numeroItem] ?? "";
                      const qty = raw.trim() === "" ? 0 : Number(raw);
                      const invalido =
                        !Number.isInteger(qty) || qty < 0 || qty > item.quantidadeDisponivel;
                      const esgotado = item.quantidadeDisponivel === 0;
                      const inputId = `dev-${chave}-${item.numeroItem}`;
                      return (
                        <tr key={item.numeroItem} className={esgotado ? "opacity-60" : undefined}>
                          <td className="px-3 py-2 min-w-0">
                            <label htmlFor={inputId} className="block font-medium truncate" title={item.nome}>
                              {item.numeroItem}. {item.nome}
                            </label>
                            <div className="font-mono text-[12px] text-muted-foreground truncate">
                              {item.sku ?? item.productId} · {item.unidade}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{item.quantidadeVendida}</td>
                          <td className="px-3 py-2 text-right font-mono">{item.quantidadeDevolvida}</td>
                          <td className="px-3 py-2 text-right font-mono">{item.quantidadeDisponivel}</td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              id={inputId}
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={item.quantidadeDisponivel}
                              step={1}
                              value={raw}
                              disabled={pending || esgotado}
                              aria-invalid={invalido || undefined}
                              aria-label={`Quantidade a devolver do item ${item.numeroItem}`}
                              className={`h-8 text-right font-mono ${invalido ? "border-destructive" : ""}`}
                              onChange={(e) =>
                                setQuantidades((prev) => ({
                                  ...prev,
                                  [item.numeroItem]: e.target.value,
                                }))
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between gap-3 text-[13px]">
                <p className="text-muted-foreground">
                  {montado == null
                    ? "Informe quantidades inteiras entre 0 e o disponível."
                    : montado.total === 0
                      ? "Nenhuma unidade selecionada."
                      : devolvendoTudo
                        ? `Devolução integral do restante (${montado.total} un.).`
                        : `Devolução parcial: ${montado.total} de ${restante} un. restantes.`}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending || devolvendoTudo}
                  onClick={() => setQuantidades(quantidadesIniciais(disponivel))}
                >
                  Devolver tudo
                </Button>
              </div>
            </div>
          )}

          {error && <p className="text-[13px] text-destructive px-1">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!podeEmitir}
              onClick={() => {
                if (!montado || montado.total === 0) return;
                startTransition(async () => {
                  const result = await devolverVendaAction(chave, montado.itens);
                  if (result.error) {
                    setError(result.error);
                    return;
                  }
                  setOpen(false);
                  router.refresh();
                });
              }}
            >
              {pending ? "Emitindo…" : devolvendoTudo ? "Emitir devolução" : "Emitir devolução parcial"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
