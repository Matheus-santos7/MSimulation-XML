"use server";

import { revalidatePath } from "next/cache";
import { backfillNfeValidation } from "@/lib/fiscal-api/validation-insights";

export type NfeValidationBackfillState = {
  error?: string;
  success?: boolean;
  processed?: number;
  approved?: number;
  rejected?: number;
  pending?: number;
  skipped?: number;
  remaining?: number;
};

export async function revalidarNfesPendentesAction(): Promise<NfeValidationBackfillState> {
  try {
    const result = await backfillNfeValidation();
    revalidatePath("/ia");
    revalidatePath("/nfe");
    revalidatePath("/");
    return {
      success: true,
      processed: result.processed,
      approved: result.approved,
      rejected: result.rejected,
      pending: result.pending,
      skipped: result.skipped,
      remaining: result.remaining,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao revalidar NF-es pendentes" };
  }
}
