import "server-only";

/**
 * YIP Chapter Round Report — Section 4 (Parties & Government) data helper.
 *
 * Mirrors lib/yip/report/sections/overview.ts EXACTLY:
 *   - `import "server-only"` data module (NOT a "use server" file) so it may
 *     export types + an async getter.
 *   - gate with getYipEventAccess(eventId); if !canView return null so the
 *     section renders nothing rather than throwing inside the page's Suspense.
 *   - read yip.* via createServiceClient() (already db.schema="yip" — plain
 *     `.from("parties")` / `.from("participants")`, no `.schema()` needed).
 *
 * Section 4 assembles two blocks:
 *   4a Parties Formed — each party (name, symbol, number, side) + its party
 *      leader's name (parties.party_leader_id → participants.full_name).
 *   4b Government & Opposition — participants grouped by their parliament_role
 *      (PM, Deputy PM, cabinet ministers w/ portfolio, LoP, shadow ministers),
 *      plus Speaker / Deputy Speaker as the presiding chair.
 */
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";

export type PartyFormed = {
  id: string;
  name: string;
  partyNumber: number | null;
  /** "ruling" | "opposition" | null (benchless until event-day decision). */
  side: string | null;
  tagline: string | null;
  /** Emoji / short text / image URL stored on parties.symbol_url. */
  symbolUrl: string | null;
  leaderName: string | null;
};

export type GovtMember = {
  name: string;
  /** Pretty parliament_role label, e.g. "Cabinet Minister". */
  roleLabel: string;
  /** Portfolio (participants.ministry) — only set for ministers. */
  portfolio: string | null;
  /** Party number for a small badge, when assigned. */
  partyNumber: number | null;
  constituency: string | null;
};

export type PartiesGovernmentData = {
  parties: PartyFormed[];
  /** Presiding officers: Speaker, Deputy Speaker. */
  presiding: GovtMember[];
  /** The treasury bench: PM, Deputy PM, Cabinet Ministers. */
  government: GovtMember[];
  /** The opposition bench: LoP, Shadow Ministers. */
  opposition: GovtMember[];
};

/** Human-friendly label for a parliament_role enum slug. */
function prettyRole(role: string): string {
  const map: Record<string, string> = {
    prime_minister: "Prime Minister",
    deputy_prime_minister: "Deputy Prime Minister",
    cabinet_minister: "Cabinet Minister",
    leader_of_opposition: "Leader of Opposition",
    shadow_minister: "Shadow Minister",
    speaker: "Speaker",
    deputy_speaker: "Deputy Speaker",
    nominated_speaker: "Nominated Speaker",
  };
  if (map[role]) return map[role];
  return role
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Fetch everything Section 4 renders. Returns `null` when the caller lacks view
 * access (the section component then renders nothing).
 */
export async function getPartiesGovernmentData(
  eventId: string
): Promise<PartiesGovernmentData | null> {
  const access = await getYipEventAccess(eventId);
  if (!access.canView) return null;

  const svc = await createServiceClient();

  // ── Parties + participants (single pass each) ───────────────────────
  const [partiesRes, participantsRes] = await Promise.all([
    svc
      .from("parties")
      .select(
        "id, name, party_number, side, tagline, symbol_url, party_leader_id"
      )
      .eq("event_id", eventId)
      .order("side")
      .order("party_number"),
    svc
      .from("participants")
      .select(
        "id, full_name, parliament_role, ministry, party_number, constituency_name"
      )
      .eq("event_id", eventId),
  ]);

  const partyRows = (partiesRes.data ?? []) as Array<{
    id: string;
    name: string | null;
    party_number: number | null;
    side: string | null;
    tagline: string | null;
    symbol_url: string | null;
    party_leader_id: string | null;
  }>;

  const participantRows = (participantsRes.data ?? []) as Array<{
    id: string;
    full_name: string | null;
    parliament_role: string | null;
    ministry: string | null;
    party_number: number | null;
    constituency_name: string | null;
  }>;

  // Lookup of participant id → name for resolving party leaders.
  const nameById = new Map<string, string>();
  for (const p of participantRows) {
    if (p.id && p.full_name) nameById.set(String(p.id), String(p.full_name));
  }

  const parties: PartyFormed[] = partyRows.map((p) => ({
    id: String(p.id),
    name: p.name ?? "Unnamed party",
    partyNumber: p.party_number,
    side: p.side,
    tagline: p.tagline,
    symbolUrl: p.symbol_url,
    leaderName: p.party_leader_id
      ? nameById.get(String(p.party_leader_id)) ?? null
      : null,
  }));

  // ── Government / Opposition / Presiding from parliament_role ─────────
  const toMember = (p: (typeof participantRows)[number]): GovtMember => ({
    name: p.full_name ?? "—",
    roleLabel: prettyRole(String(p.parliament_role ?? "")),
    portfolio: p.ministry ? String(p.ministry) : null,
    partyNumber: p.party_number,
    constituency: p.constituency_name ? String(p.constituency_name) : null,
  });

  // Rank so each bench lists its senior-most role first.
  const govRank: Record<string, number> = {
    prime_minister: 0,
    deputy_prime_minister: 1,
    cabinet_minister: 2,
  };
  const oppRank: Record<string, number> = {
    leader_of_opposition: 0,
    shadow_minister: 1,
  };
  const presideRank: Record<string, number> = {
    speaker: 0,
    nominated_speaker: 0,
    deputy_speaker: 1,
  };

  const named = participantRows.filter(
    (p) => p.full_name && p.parliament_role
  );

  const government = named
    .filter((p) => p.parliament_role! in govRank)
    .sort(
      (a, b) =>
        govRank[a.parliament_role!] - govRank[b.parliament_role!] ||
        (a.full_name ?? "").localeCompare(b.full_name ?? "")
    )
    .map(toMember);

  const opposition = named
    .filter((p) => p.parliament_role! in oppRank)
    .sort(
      (a, b) =>
        oppRank[a.parliament_role!] - oppRank[b.parliament_role!] ||
        (a.full_name ?? "").localeCompare(b.full_name ?? "")
    )
    .map(toMember);

  const presiding = named
    .filter((p) => p.parliament_role! in presideRank)
    .sort(
      (a, b) =>
        presideRank[a.parliament_role!] - presideRank[b.parliament_role!] ||
        (a.full_name ?? "").localeCompare(b.full_name ?? "")
    )
    .map(toMember);

  return { parties, presiding, government, opposition };
}
