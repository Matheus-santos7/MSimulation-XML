"use client";

import { FiscalSettingsFormShell } from "@/components/fiscal-settings-form";
import { Label } from "@/components/ui/label";

type Props = {
  title: string;
  description: string;
  fieldId: string;
  initial: boolean;
  labelOn: string;
  labelOff: string;
  section: "nfe" | "basic";
  patchKey: string;
};

export function ToggleConfigForm({
  title,
  description,
  fieldId,
  initial,
  labelOn,
  labelOff,
  section,
  patchKey,
}: Props) {
  return (
    <FiscalSettingsFormShell
      title={title}
      onSave={() => {
        const checked = (document.getElementById(fieldId) as HTMLInputElement).checked;
        if (section === "nfe") {
          return { nfe: { [patchKey]: checked } };
        }
        return { basic: { [patchKey]: checked } };
      }}
    >
      <p className="text-[13px] text-muted-foreground">{description}</p>
      <div className="flex items-start gap-3">
        <input
          id={fieldId}
          type="checkbox"
          defaultChecked={initial}
          className="mt-1 size-4 rounded border-input"
        />
        <Label htmlFor={fieldId} className="font-normal leading-snug">
          {initial ? labelOn : labelOff}
        </Label>
      </div>
    </FiscalSettingsFormShell>
  );
}
