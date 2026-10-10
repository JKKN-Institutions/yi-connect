"use server";

import { revalidatePath } from "next/cache";
import { hasReviewSession, requireTpOrganiser } from "@/lib/take-pride/auth";
import { tpService } from "@/lib/take-pride/supabase";
import { mapImport, type TpImportPreviewData } from "@/lib/take-pride/import";
import type { TpResult } from "@/lib/take-pride/types";
import { planImport, removeUncheckedSamples, runImport } from "./_core";

/*
 * Organiser-only. Every action re-checks the gate and denies with
 * { success:false, error }. The import is always re-read from the raw text
 * on the server: rows mapped in the browser are never trusted.
 */

const DENIED = "Only Take Pride organisers can do this. Sign in with your Yi account.";

/** Real organisers only; review mode gets its own plain refusal. */
async function denial(): Promise<string> {
  return (await hasReviewSession()) ? "Not available in review mode." : DENIED;
}

export async function previewDelegateImport(text: string): Promise<TpResult<TpImportPreviewData>> {
  const g = await requireTpOrganiser();
  if (!g.ok) return { success: false, error: await denial() };
  const parsed = mapImport(text);
  if (!parsed.ok) return { success: false, error: parsed.error };
  try {
    const plan = await planImport(tpService(), parsed.rows);
    return {
      success: true,
      data: {
        columns: parsed.columns as Record<string, string>,
        dataRows: parsed.dataRows,
        ready: plan.toInsert.length,
        sample: plan.toInsert.slice(0, 10),
        skipped: [...parsed.skipped, ...plan.alreadyListed].sort((a, b) => a.line - b.line),
      },
    };
  } catch {
    return { success: false, error: "Could not read the current delegate list. Please try again." };
  }
}

export async function confirmDelegateImport(text: string): Promise<TpResult<{ inserted: number; skipped: number; warning: string | null }>> {
  const g = await requireTpOrganiser();
  if (!g.ok) return { success: false, error: await denial() };
  const parsed = mapImport(text);
  if (!parsed.ok) return { success: false, error: parsed.error };
  if (parsed.rows.length === 0) return { success: false, error: "No rows are ready to import. Fix the skipped rows and try again." };
  try {
    const out = await runImport(tpService(), parsed.rows);
    if (out.inserted > 0) revalidatePath("/take-pride", "layout");
    if (out.error && out.inserted === 0) return { success: false, error: out.error };
    return {
      success: true,
      data: { inserted: out.inserted, skipped: parsed.skipped.length + out.alreadyListed.length, warning: out.error },
    };
  } catch {
    return { success: false, error: "Could not finish saving. Reload the page to see which delegates were added, then import again (already-added rows are skipped)." };
  }
}

export async function removeSampleDelegates(confirmWord: string): Promise<TpResult<{ removed: number }>> {
  const g = await requireTpOrganiser();
  if (!g.ok) return { success: false, error: await denial() };
  if ((confirmWord ?? "").trim().toUpperCase() !== "REMOVE") return { success: false, error: 'Type REMOVE to confirm.' };
  try {
    const removed = await removeUncheckedSamples(tpService());
    revalidatePath("/take-pride", "layout");
    return { success: true, data: { removed } };
  } catch {
    return { success: false, error: "Could not remove the sample delegates. Please try again." };
  }
}
