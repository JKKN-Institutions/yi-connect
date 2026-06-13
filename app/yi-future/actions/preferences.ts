"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import { resolveFutureAccessOrNull } from "@/lib/yi-future/auth/require-access";
import type { ActionResult } from "./editions";

// ─── TYPES ──────────────────────────────────────────────────────────
export type PreferenceRow = {
  rank: 1 | 2 | 3;
  problem: {
    id: string;
    title: string;
    track_slug: string;
    track_name: string;
  };
};

// ─── SET PREFERENCES (captain-only, exactly 3 ranked) ──────────────
export async function setPreferences(
  teamId: string,
  ranked: string[]
): Promise<ActionResult> {
  // Validate caller is a delegate session
  const session = await readSession();
  if (!session || session.type !== "delegate") {
    return { ok: false, error: "Sign in as a delegate to rank problems." };
  }

  // Validate exactly 3 distinct problem ids
  if (!Array.isArray(ranked) || ranked.length !== 3) {
    return { ok: false, error: "Pick exactly 3 problems — your top 3." };
  }
  const trimmed = ranked.map((s) => String(s ?? "").trim()).filter(Boolean);
  if (trimmed.length !== 3) {
    return { ok: false, error: "Pick exactly 3 problems — your top 3." };
  }
  const distinct = new Set(trimmed);
  if (distinct.size !== 3) {
    return { ok: false, error: "Your three picks must be different." };
  }

  const svc = await createServiceClient();

  // Verify team exists, get captain + frozen state + leader fallback
  const { data: teamRow } = (await svc
    .schema("future")
    .from("teams")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select("id, captain_id, leader_delegate_id, is_frozen, edition_id" as any)
    .eq("id", teamId)
    .maybeSingle()) as unknown as {
    data: {
      id: string;
      captain_id: string | null;
      leader_delegate_id: string | null;
      is_frozen: boolean | null;
      edition_id: string;
    } | null;
  };

  if (!teamRow) return { ok: false, error: "Team not found." };

  // Captain check — accept either captain_id or leader_delegate_id
  const isCaptain =
    teamRow.captain_id === session.id ||
    teamRow.leader_delegate_id === session.id;
  if (!isCaptain) {
    return { ok: false, error: "Only the team captain can rank problems." };
  }

  if (teamRow.is_frozen === true) {
    return {
      ok: false,
      error: "Team is frozen. Ask your chapter admin to unfreeze before re-ranking.",
    };
  }

  // Validate that all 3 problems exist + belong to the same edition
  const { data: problemsCheck } = await svc
    .schema("future")
    .from("problem_statements")
    .select("id, tracks!inner(edition_id)")
    .in("id", trimmed);

  const checkRows =
    (problemsCheck as unknown as {
      id: string;
      tracks: { edition_id: string };
    }[]) ?? [];

  if (checkRows.length !== 3) {
    return { ok: false, error: "One or more selected problems were not found." };
  }
  const wrongEdition = checkRows.some(
    (r) => r.tracks.edition_id !== teamRow.edition_id
  );
  if (wrongEdition) {
    return {
      ok: false,
      error: "All picks must be from your edition's tracks.",
    };
  }

  // Clear existing preferences for this team
  const { error: delErr } = await svc
    .schema("future")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("problem_preferences" as any)
    .delete()
    .eq("team_id", teamId);
  if (delErr) return { ok: false, error: delErr.message };

  // Insert the 3 ranked rows
  const rows = trimmed.map((pid, idx) => ({
    team_id: teamId,
    problem_statement_id: pid,
    rank: (idx + 1) as 1 | 2 | 3,
  }));

  const { error: insErr } = await svc
    .schema("future")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("problem_preferences" as any)
    .insert(rows as never);
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath("/yi-future/me/team/preferences");
  revalidatePath("/yi-future/me/team");
  revalidatePath("/yi-future/chapter/allocations");
  return { ok: true, message: "Top 3 saved." };
}

// ─── GET PREFERENCES (returns ranked list with problem + track info) ─
export async function getPreferences(teamId: string): Promise<PreferenceRow[]> {
  const svc = await createServiceClient();

  // SECURITY: a team's ranked problem picks are competitive strategy. Bind the
  // caller — only a delegate ON this team, or a Future national admin, may read
  // them. (Defense in depth: today the sole caller is the team's own server
  // page, but this is a "use server" export and must not trust its argument.)
  const session = await readSession();
  let authorized = false;
  if (session?.type === "delegate") {
    const { data: membership } = await svc
      .schema("future")
      .from("team_members")
      .select("team_id")
      .eq("team_id", teamId)
      .eq("delegate_id", session.id)
      .maybeSingle();
    authorized = !!membership;
  }
  if (!authorized) {
    const admin = await resolveFutureAccessOrNull();
    authorized = !!admin?.isNational;
  }
  if (!authorized) return [];

  const { data } = await svc
    .schema("future")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("problem_preferences" as any)
    .select(
      "rank, problem_statements!inner(id, title, tracks!inner(slug, name))"
    )
    .eq("team_id", teamId)
    .order("rank", { ascending: true });

  const rows =
    (data as unknown as {
      rank: number;
      problem_statements: {
        id: string;
        title: string;
        tracks: { slug: string; name: string };
      };
    }[]) ?? [];

  return rows.map((r) => ({
    rank: r.rank as 1 | 2 | 3,
    problem: {
      id: r.problem_statements.id,
      title: r.problem_statements.title,
      track_slug: r.problem_statements.tracks.slug,
      track_name: r.problem_statements.tracks.name,
    },
  }));
}
