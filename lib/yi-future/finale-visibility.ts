import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";

/**
 * Returns true if the edition has a `finale_visibility_cutoff` set AND the
 * current time is at or after that cutoff.
 *
 * PRD §7.1 — Finale (host) chapter admins are also competing teams, so they
 * must NOT see other chapters' rankings/submissions until after the cutoff
 * date set by Yi National.
 */
export async function isFinaleVisibilityOpen(
  editionId: string
): Promise<boolean> {
  if (!editionId) return false;
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("editions")
    .select("finale_visibility_cutoff")
    .eq("id", editionId)
    .maybeSingle();

  const row = data as unknown as {
    finale_visibility_cutoff: string | null;
  } | null;

  const cutoff = row?.finale_visibility_cutoff ?? null;
  if (!cutoff) return false;

  const cutoffMs = Date.parse(cutoff);
  if (Number.isNaN(cutoffMs)) return false;

  return Date.now() >= cutoffMs;
}

/**
 * Server-side guard. If finale visibility is NOT yet open, redirects the
 * caller to a "locked" page. Use at the top of any host/finale page that
 * would expose cross-chapter rankings or submissions.
 *
 * Usage:
 *   await requireFinaleVisibility(editionId);
 */
export async function requireFinaleVisibility(
  editionId: string,
  redirectTo: string = "/host?locked=finale_visibility"
): Promise<void> {
  const open = await isFinaleVisibilityOpen(editionId);
  if (!open) redirect(redirectTo);
}
