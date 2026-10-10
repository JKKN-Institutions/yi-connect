"use server";

import { revalidatePath } from "next/cache";
import { requireTpOrganiser } from "@/lib/take-pride/auth";
import { cancelCircleAsOrganiser, createOrganiserCircle, type TableInput } from "@/lib/take-pride/tables";
import type { TpResult } from "@/lib/take-pride/types";

/* Organiser desk: create and cancel topic tables. Gate first, deny explicitly. */

async function denied(): Promise<string | null> {
  const g = await requireTpOrganiser();
  if (g.ok) return null;
  return g.reason === "signed_out" ? "Sign in needed" : "Only the Take Pride team can do this";
}

export async function createTable(input: TableInput): Promise<TpResult<{ id: string }>> {
  const no = await denied();
  if (no) return { success: false, error: no };
  const r = await createOrganiserCircle(input);
  if (r.success) revalidatePath("/take-pride/desk/tables");
  return r;
}

export async function cancelTable(circleId: string): Promise<TpResult> {
  const no = await denied();
  if (no) return { success: false, error: no };
  const r = await cancelCircleAsOrganiser(circleId);
  if (r.success) revalidatePath("/take-pride/desk/tables");
  return r;
}
