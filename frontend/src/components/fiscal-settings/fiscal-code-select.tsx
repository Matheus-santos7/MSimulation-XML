"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { FiscalOption } from "@/lib/fiscal-settings-constants";
import { cn } from "@/lib/utils";

type Props = {
  options: FiscalOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function FiscalCodeSelect({ options, value, onChange, placeholder = "Selecionar", className }: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  const display = useMemo(() => {
    if (!selected) return placeholder;
    const short = `${selected.value} - ${selected.label.split(" - ").slice(1).join(" - ") || selected.label}`;
    return short.length > 72 ? `${selected.value} - ${selected.label.slice(0, 60)}…` : `${selected.value} - ${selected.label.replace(/^\d+\s*-\s*/, "")}`;
  }, [selected, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("h-9 w-full justify-between font-normal", className)}
        >
          <span className="truncate text-left">{display}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,28rem)] p-0" align="end">
        <Command>
          <CommandInput placeholder="Procurar" />
          <CommandList>
            <CommandEmpty>Nenhum código encontrado.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={`${opt.value} ${opt.label}`}
                  onSelect={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className="items-start py-2"
                >
                  <Check className={cn("mr-2 mt-0.5 h-4 w-4", value === opt.value ? "opacity-100" : "opacity-0")} />
                  <span className="whitespace-normal text-left leading-snug">{opt.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
