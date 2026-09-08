/**
 * WhatsApp group invite links for a student's party and committee.
 *
 * Each student belongs to one party and one committee, each of which has its
 * own WhatsApp group. The access-code email carries whichever of those two
 * links exist, so a student gets their code and both groups in one message.
 *
 * A link is stored in two different places because the two things are shaped
 * differently: a party is a real row (yip.parties.whatsapp_invite_url), while a
 * committee is only a key in events.committee_topics, so committee links live
 * in events.committee_whatsapp keyed by the committee NUMBER — the identity a
 * chapter keeps when it later attributes a ministry to that number.
 *
 * BENCH GROUPS (2026-08-19). Regional rounds split the House into a ruling and
 * an opposition bench, and each bench has its own group. A bench is neither a
 * row nor a numbered thing — there are exactly two of them per event — so its
 * links live in events.bench_whatsapp keyed by the side ('ruling' /
 * 'opposition'), the same shape committee_whatsapp uses.
 *
 * A student can therefore hold up to THREE groups: their party, their committee,
 * and their bench. Which bench link they see is decided by
 * yip.participants.party_side, so a student who has no bench yet simply sees no
 * bench group — never the wrong one.
 */

/** A committee number → invite link map, as stored in events.committee_whatsapp. */
export type CommitteeWhatsappMap = Record<string, string>;

/**
 * Accept only a real WhatsApp group invite. These are always
 * https://chat.whatsapp.com/<code>, so anything else is a mistyped or pasted
 * wrong link and is rejected rather than silently emailed to a room full of
 * students. `whatsapp.com/channel/...` is a CHANNEL, not a group, and does not
 * let anyone join a chat — also rejected, because it looks close enough to be
 * pasted by accident.
 */
export function isValidWhatsappInvite(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const url = raw.trim();
  if (url.length > 300) return false;
  return /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{6,}$/.test(url);
}

/** Trim to a storable value; empty/blank becomes null (clears the link). */
export function normalizeWhatsappInvite(
  raw: string | null | undefined
): string | null {
  const url = (raw ?? "").trim();
  return url === "" ? null : url;
}

/** Read one committee's link out of the event's map. */
export function committeeWhatsappFor(
  map: unknown,
  committeeNumber: number | null | undefined
): string | null {
  if (committeeNumber == null) return null;
  if (!map || typeof map !== "object" || Array.isArray(map)) return null;
  const v = (map as Record<string, unknown>)[String(committeeNumber)];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/** Set or clear one committee's link, returning a new map (never mutates). */
export function withCommitteeWhatsapp(
  map: unknown,
  committeeNumber: number,
  url: string | null
): CommitteeWhatsappMap {
  const base: CommitteeWhatsappMap =
    map && typeof map === "object" && !Array.isArray(map)
      ? Object.fromEntries(
          Object.entries(map as Record<string, unknown>)
            .filter(([, v]) => typeof v === "string")
            .map(([k, v]) => [k, v as string])
        )
      : {};
  const key = String(committeeNumber);
  if (url === null) delete base[key];
  else base[key] = url;
  return base;
}

/** The two benches an event can carry a group for. */
export type BenchSide = "ruling" | "opposition";

/** A side → invite link map, as stored in events.bench_whatsapp. */
export type BenchWhatsappMap = Partial<Record<BenchSide, string>>;

/** Plain-English name for a bench, for labels and email copy. */
export const BENCH_LABEL: Record<BenchSide, string> = {
  ruling: "Treasury (ruling) bench",
  opposition: "Opposition bench",
};

/** True for a value that is actually one of the two benches. */
export function isBenchSide(v: unknown): v is BenchSide {
  return v === "ruling" || v === "opposition";
}

/**
 * Read one bench's link out of the event's map.
 *
 * `side` is the student's yip.participants.party_side, which is NULL until an
 * organiser sets the benches — so this returns null rather than guessing, in
 * exactly the same way the jury screen refuses to guess a bench.
 */
export function benchWhatsappFor(
  map: unknown,
  side: string | null | undefined
): string | null {
  if (!isBenchSide(side)) return null;
  if (!map || typeof map !== "object" || Array.isArray(map)) return null;
  const v = (map as Record<string, unknown>)[side];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/** Set or clear one bench's link, returning a new map (never mutates). */
export function withBenchWhatsapp(
  map: unknown,
  side: BenchSide,
  url: string | null
): BenchWhatsappMap {
  const base: BenchWhatsappMap =
    map && typeof map === "object" && !Array.isArray(map)
      ? Object.fromEntries(
          Object.entries(map as Record<string, unknown>)
            .filter(([k, v]) => isBenchSide(k) && typeof v === "string")
            .map(([k, v]) => [k, v as string])
        )
      : {};
  if (url === null) delete base[side];
  else base[side] = url;
  return base;
}

/**
 * The help text shown wherever an organiser types one of these in. Kept here so
 * the Parties tab and the Committees tab say exactly the same thing.
 */
export const WHATSAPP_INVITE_HINT =
  "In WhatsApp: open the group → Group info → Invite via link → Copy link. It looks like https://chat.whatsapp.com/…";
