"use server";

// ═══════════════════════════════════════════════════════════════════════
// Merge a whole cluster of duplicate college spellings into one row.
//
// Deliberately NOT a new merge mechanism: it re-links delegates and sets
// merged_into exactly as mergePendingCollege in ./colleges.ts does, because
// that soft-merge (source row KEPT, merged_into set) is the agreed shape and
// the rest of the app reads it. What this adds is (a) doing it for several
// sources at once so a chair approves a cluster rather than 19 pairs, and
// (b) an ownership check.
//
// The ownership check is the reason this could not simply loop over the
// existing action: mergePendingCollege verifies the two colleges share a
// chapter, but never that the CALLER administers that chapter — so a chair
// of chapter A can merge chapter B's colleges. This gate fails closed.
// ═══════════════════════════════════════════════════════════════════════

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { resolveFutureAccessOrNull } from "@/lib/yi-future/auth/require-access";
import type { MergeClusterResult } from "@/lib/yi-future/college-dedupe";

export async function mergeCollegeCluster(input: {
  chapterId: string;
  targetId: string;
  sourceIds: string[];
}): Promise<MergeClusterResult> {
  const { chapterId, targetId } = input;
  const sourceIds = [...new Set(input.sourceIds ?? [])].filter(
    (id) => id && id !== targetId
  );

  // ─── 1. Authorization — fail CLOSED, deny EXPLICITLY ──────────────────
  // resolveFutureAccessOrNull rather than requireChapterAdmin: the latter
  // redirect()s, which throws instead of returning something the screen can
  // show the chair.
  const access = await resolveFutureAccessOrNull();
  if (!access) {
    return { ok: false, error: "Please sign in again — your session expired." };
  }
  if (!chapterId || !targetId) {
    return { ok: false, error: "Missing chapter or target college." };
  }
  if (!access.isNational && !access.chapterIds.includes(chapterId)) {
    return {
      ok: false,
      error: "You can only merge colleges in your own chapter.",
    };
  }
  if (sourceIds.length === 0) {
    return { ok: false, error: "Nothing to merge." };
  }

  const svc = await createServiceClient();

  // ─── 2. Every row must belong to THIS chapter ─────────────────────────
  // Read them in one go and verify, rather than trusting the ids the form
  // posted — the form is client-side and a chair could be looking at a stale
  // page, or someone could post ids by hand.
  const { data: rowsRaw, error: readErr } = await svc
    .schema("future")
    .from("colleges")
    .select("id, name, chapter_id, is_approved, merged_into")
    .in("id", [targetId, ...sourceIds]);
  if (readErr) return { ok: false, error: readErr.message };

  const rows =
    (rowsRaw as {
      id: string;
      name: string;
      chapter_id: string | null;
      is_approved: boolean;
      merged_into: string | null;
    }[] | null) ?? [];

  const target = rows.find((r) => r.id === targetId);
  if (!target) return { ok: false, error: "Target college not found." };
  if (target.chapter_id !== chapterId) {
    return { ok: false, error: "That college belongs to another chapter." };
  }
  if (target.merged_into) {
    return {
      ok: false,
      error: `"${target.name}" has itself already been merged away. Reload the page.`,
    };
  }

  const sources = rows.filter((r) => r.id !== targetId);
  const foreign = sources.filter((r) => r.chapter_id !== chapterId);
  if (foreign.length > 0) {
    return { ok: false, error: "Cross-chapter merges are not allowed." };
  }

  // ─── 3. The target must be approved ───────────────────────────────────
  // Same rule mergePendingCollege enforces. When the winning spelling is one
  // a chapter never approved, approve it here rather than making the chair
  // go to another tab and come back — they have just approved this cluster,
  // which is the same decision.
  if (target.is_approved !== true) {
    const { error } = await svc
      .schema("future")
      .from("colleges")
      .update({ is_approved: true } as never)
      .eq("id", targetId);
    if (error) return { ok: false, error: error.message };
  }

  // ─── 4. Merge, one source at a time ───────────────────────────────────
  // Per source, not one bulk update: a single failure must cost that variant,
  // not the whole cluster. Row counts come back via RETURNING rather than
  // being assumed — a silently-zero update is the failure mode that hides
  // here (an already-merged source re-links nothing and looks identical to
  // success).
  let merged = 0;
  let delegatesMoved = 0;
  const failures: string[] = [];

  for (const s of sources) {
    if (s.merged_into) continue; // already folded away by someone else

    const { data: moved, error: relinkErr } = await svc
      .schema("future")
      .from("delegates")
      .update({ college_id: targetId } as never)
      .eq("college_id", s.id)
      .select("id");
    if (relinkErr) {
      failures.push(`${s.name}: ${relinkErr.message}`);
      continue;
    }

    const { error: mergeErr } = await svc
      .schema("future")
      .from("colleges")
      .update({ merged_into: targetId, is_approved: false } as never)
      .eq("id", s.id);
    if (mergeErr) {
      failures.push(`${s.name}: ${mergeErr.message}`);
      continue;
    }

    merged++;
    delegatesMoved += ((moved as { id: string }[] | null) ?? []).length;
  }

  revalidatePath("/yi-future/chapter/colleges");
  revalidatePath("/yi-future/chapter/delegates");

  return { ok: true, merged, delegatesMoved, failures };
}
