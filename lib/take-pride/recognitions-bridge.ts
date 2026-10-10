import "server-only";

import { tpService } from "./supabase";
import { effectiveStatus } from "@/lib/recognitions/check-rules";
import { isPast } from "@/lib/recognitions/phase";
import { CATEGORIES, CATEGORY_LABEL, type Category } from "@/lib/recognitions/constants";

/**
 * Take Pride <-> Yi Recognitions bridge. READ-ONLY on the recognition_*
 * tables (service client; RLS on, zero policies there too).
 *
 * SAFEGUARD — what may leave this file:
 *   - the chapter's OWN nominations: award title, category, a coarse stage
 *   - a WINNER only for an award x category that the organiser desk has
 *     revealed for real (tp_award_reveals.is_rehearsal = false) AND whose
 *     Recognitions result is APPROVED at read time
 * Never: scores, ranks, runner-ups, other chapters' nominations, or any
 * winner before its real reveal. recognition_scores is never read here.
 *
 * "Approved" mirrors lib/recognitions/phase.ts computePhase() === "finalized":
 * the nomination deadline has passed, the LATEST moderation version is
 * submitted, and the latest governance decision on that version is
 * "approve". Any doubt (missing row, read error) = not approved.
 */

export { CATEGORIES, CATEGORY_LABEL };
export type { Category };

export const REHEARSAL_WINNER = "Chapter to be announced";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(s: unknown): s is string {
  return typeof s === "string" && UUID.test(s);
}
export function isCategory(s: unknown): s is Category {
  return typeof s === "string" && (CATEGORIES as readonly string[]).includes(s);
}

type Cycle = {
  id: string;
  name: string;
  nomination_deadline: string | null;
  fix_deadline: string | null;
  check_deadline: string | null;
  stage1_deadline: string | null;
  stage2_deadline: string | null;
};
type Award = { id: string; title: string; vertical: string; sort_order: number; stage2_unlocked_at: string | null };
type Chapter = { id: string; name: string; city: string | null; region: string | null };
type Top3 = { category: string; rank: number | string; nomination_id: string; citation?: string | null };

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`take-pride bridge: ${context} failed: ${error?.message ?? "unknown error"}`);
}

export async function getCurrentCycle(): Promise<Cycle | null> {
  const { data, error } = await tpService()
    .from("recognition_cycles")
    .select("id, name, nomination_deadline, fix_deadline, check_deadline, stage1_deadline, stage2_deadline")
    .eq("is_current", true)
    .maybeSingle();
  if (error) fail("read current cycle", error);
  return (data as Cycle | null) ?? null;
}

async function listAwards(cycleId: string): Promise<Award[]> {
  const { data, error } = await tpService()
    .from("recognition_awards")
    .select("id, title, vertical, sort_order, stage2_unlocked_at")
    .eq("cycle_id", cycleId)
    .eq("is_active", true)
    .order("sort_order")
    .order("title");
  if (error) fail("list awards", error);
  return (data ?? []) as Award[];
}

async function listChapters(): Promise<Chapter[]> {
  const { data, error } = await tpService()
    .schema("yi")
    .from("chapters")
    .select("id, name, city, region")
    .eq("is_active", true);
  if (error) fail("list chapters", error);
  return (data ?? []) as Chapter[];
}

/** "Yi Erode", "erode", " Erode Chapter " -> "erode". */
export function normaliseChapter(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^yi\s+/, "")
    .replace(/\s+chapter$/, "")
    .trim();
}

/**
 * Map a delegate's chapter text to ONE Recognitions chapter (yi.chapters).
 * Name first, then city (Yi Vizag -> Visakhapatnam, whose city is Vizag).
 * Two or more matches = ambiguous = no match: never guess.
 */
export async function resolveChapter(text: string): Promise<Chapter | null> {
  const key = normaliseChapter(text);
  if (!key) return null;
  const all = await listChapters();
  const byName = all.filter((c) => normaliseChapter(c.name) === key);
  if (byName.length === 1) return byName[0];
  if (byName.length > 1) return null;
  const byCity = all.filter((c) => normaliseChapter(c.city) === key);
  return byCity.length === 1 ? byCity[0] : null;
}

// ---------------------------------------------------------------------------
// Approved result + winner (server-side only; never sent anywhere unrevealed)
// ---------------------------------------------------------------------------

type Approved = { versionId: string; top3: Top3[] };
type Winner = { chapterId: string; chapterName: string; citation: string | null };
type Db = ReturnType<typeof tpService>;

/**
 * Per-request lookups. One service client, and each award's approval (and
 * each award x version x category winner) is read at most once per request,
 * however many reveal rows or nominations point at it.
 */
type Ctx = {
  db: Db;
  approved: Map<string, Promise<Approved | null>>;
  winners: Map<string, Promise<Winner | null>>;
};
function newCtx(): Ctx {
  return { db: tpService(), approved: new Map(), winners: new Map() };
}

function approvedResult(ctx: Ctx, award: Pick<Award, "id">, cycle: Pick<Cycle, "nomination_deadline">): Promise<Approved | null> {
  let p = ctx.approved.get(award.id);
  if (!p) {
    p = readApproved(ctx.db, award, cycle);
    ctx.approved.set(award.id, p);
  }
  return p;
}

function winnerOf(ctx: Ctx, awardId: string, approved: Approved, category: Category): Promise<Winner | null> {
  const key = `${awardId}:${approved.versionId}:${category}`;
  let p = ctx.winners.get(key);
  if (!p) {
    p = readWinner(ctx.db, awardId, approved, category);
    ctx.winners.set(key, p);
  }
  return p;
}

/** The approved moderation for an award, or null. Fails closed. */
async function readApproved(db: Db, award: Pick<Award, "id">, cycle: Pick<Cycle, "nomination_deadline">): Promise<Approved | null> {
  if (!isPast(cycle.nomination_deadline)) return null;
  const { data: versions, error } = await db
    .from("recognition_moderation_versions")
    .select("id, version, status, top3")
    .eq("award_id", award.id)
    .order("version", { ascending: false })
    .limit(1);
  if (error) return null;
  const latest = (versions ?? [])[0] as { id: string; status: string; top3: unknown } | undefined;
  if (!latest || latest.status !== "submitted") return null;
  const { data: decisions, error: dErr } = await db
    .from("recognition_governance_decisions")
    .select("decision, decided_at")
    .eq("award_id", award.id)
    .eq("moderation_version_id", latest.id)
    .order("decided_at", { ascending: false })
    .limit(1);
  if (dErr) return null;
  const decision = (decisions ?? [])[0] as { decision: string } | undefined;
  if (decision?.decision !== "approve") return null;
  return { versionId: latest.id, top3: Array.isArray(latest.top3) ? (latest.top3 as Top3[]) : [] };
}

/** Rank-1 chapter in one category of an approved result, with its citation. */
async function readWinner(db: Db, awardId: string, approved: Approved, category: Category): Promise<Winner | null> {
  const first = approved.top3.find((t) => t.category === category && Number(t.rank) === 1);
  if (!first || !isUuid(first.nomination_id)) return null;
  const { data: nom, error } = await db
    .from("recognition_nominations")
    .select("chapter_id, award_id")
    .eq("id", first.nomination_id)
    .maybeSingle();
  const n = nom as { chapter_id: string; award_id: string } | null;
  if (error || !n || n.award_id !== awardId) return null;
  const { data: ch, error: cErr } = await db.schema("yi").from("chapters").select("name").eq("id", n.chapter_id).maybeSingle();
  const name = (ch as { name: string } | null)?.name;
  if (cErr || !name) return null;
  // Latest super-admin polish of the citation on THIS version wins (same rule
  // as lib/recognitions/data.ts effectiveText), else the moderation's own text.
  const { data: edit } = await db
    .from("recognition_citation_edits")
    .select("body")
    .eq("award_id", awardId)
    .eq("moderation_version_id", approved.versionId)
    .eq("field", "citation")
    .eq("category", category)
    .eq("rank", 1)
    .order("edited_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const citation = ((edit as { body: string } | null)?.body ?? first.citation ?? "").trim();
  return { chapterId: n.chapter_id, chapterName: name, citation: citation || null };
}

// ---------------------------------------------------------------------------
// Reveals
// ---------------------------------------------------------------------------

export type RevealRow = {
  id: string;
  award_id: string;
  category: Category;
  revealed_at: string;
  is_rehearsal: boolean;
  /** The moderation version that was approved when Reveal was pressed. */
  moderation_version_id: string | null;
};

/**
 * A real reveal shows its winner only while the CURRENTLY approved version is
 * the one that was approved when the organiser pressed Reveal. If the award
 * was sent back and re-approved since, the winner stays hidden until the
 * organiser reveals again. A missing version id never matches (fail closed).
 */
function revealStillValid(r: RevealRow, approved: Approved | null): approved is Approved {
  return !!approved && !!r.moderation_version_id && r.moderation_version_id === approved.versionId;
}

async function listReveals(db: Db): Promise<RevealRow[]> {
  const { data, error } = await db
    .from("tp_award_reveals")
    .select("id, award_id, category, revealed_at, is_rehearsal, moderation_version_id")
    .order("revealed_at", { ascending: false });
  if (error) fail("list reveals", error);
  return (data ?? []) as RevealRow[];
}

/** What the hall screen may show. Built ONLY from reveal rows. */
export type FeedItem = {
  id: string;
  award: string;
  category: string;
  winner: string;
  citation: string | null;
  rehearsal: boolean;
  revealedAt: string;
};

export type RevealFeed = { eventName: string | null; items: FeedItem[] };

/**
 * Public feed. Rehearsal rows never touch Recognitions results (placeholder
 * only). A real row shows its winner only if the SAME version is still
 * approved right now; otherwise it is dropped (fail closed).
 */
async function buildRevealFeed(): Promise<RevealFeed> {
  const cycle = await getCurrentCycle();
  if (!cycle) return { eventName: null, items: [] };
  const ctx = newCtx();
  const [awards, reveals] = await Promise.all([listAwards(cycle.id), listReveals(ctx.db)]);
  const byId = new Map(awards.map((a) => [a.id, a]));
  // Reveals arrive newest first; Promise.all keeps that order.
  const rows = await Promise.all(
    reveals.map(async (r): Promise<FeedItem | null> => {
      const award = byId.get(r.award_id);
      if (!award || !isCategory(r.category)) return null;
      const base = { id: r.id, award: award.title, category: CATEGORY_LABEL[r.category], revealedAt: r.revealed_at };
      if (r.is_rehearsal) return { ...base, winner: REHEARSAL_WINNER, citation: null, rehearsal: true };
      const approved = await approvedResult(ctx, award, cycle);
      if (!revealStillValid(r, approved)) return null;
      const w = await winnerOf(ctx, award.id, approved, r.category);
      return w ? { ...base, winner: w.chapterName, citation: w.citation, rehearsal: false } : null;
    })
  );
  return { eventName: cycle.name, items: rows.filter((x): x is FeedItem => x !== null) };
}

/**
 * The feed is the same for every viewer and is polled by every phone and the
 * hall screen, so it is built at most once per FEED_TTL_MS per server
 * instance. Callers that arrive while a build is running share it. A failed
 * build is not cached.
 */
const FEED_TTL_MS = 3000;
let feedCache: { at: number; promise: Promise<RevealFeed> } | null = null;

export function getRevealFeed(): Promise<RevealFeed> {
  const now = Date.now();
  if (feedCache && now - feedCache.at < FEED_TTL_MS) return feedCache.promise;
  const promise = buildRevealFeed();
  const entry = { at: now, promise };
  feedCache = entry;
  promise.catch(() => {
    if (feedCache === entry) feedCache = null;
  });
  return promise;
}

/** Called after a desk change so this instance shows it on its next poll. */
export async function invalidateRevealFeed(): Promise<void> {
  feedCache = null;
}

// ---------------------------------------------------------------------------
// Organiser desk (caller MUST have passed requireTpOrganiser)
// ---------------------------------------------------------------------------

export type DeskCell = {
  awardId: string;
  awardTitle: string;
  category: Category;
  categoryLabel: string;
  /** An approved result exists AND it names a winner in this category. */
  canReveal: boolean;
  /** Plain-English reason when canReveal is false. */
  status: string;
  /** stale = a real reveal whose approved result has changed since; hidden until revealed again. */
  reveal: { at: string; rehearsal: boolean; stale: boolean } | null;
  /** Only filled after a REAL reveal; never before. */
  revealedWinner: string | null;
};

export async function getAwardsDesk(): Promise<{ cycleName: string | null; cells: DeskCell[]; rehearsalCount: number }> {
  const cycle = await getCurrentCycle();
  if (!cycle) return { cycleName: null, cells: [], rehearsalCount: 0 };
  const ctx = newCtx();
  const [awards, reveals] = await Promise.all([listAwards(cycle.id), listReveals(ctx.db)]);
  const revealByKey = new Map(reveals.map((r) => [`${r.award_id}:${r.category}`, r]));
  const perAward = await Promise.all(
    awards.map(async (award) => {
      const approved = await approvedResult(ctx, award, cycle);
      return Promise.all(
        CATEGORIES.map(async (category): Promise<DeskCell> => {
          const r = revealByKey.get(`${award.id}:${category}`) ?? null;
          let canReveal = false;
          let status = "Not approved yet";
          let revealedWinner: string | null = null;
          let stale = false;
          if (approved) {
            const w = await winnerOf(ctx, award.id, approved, category);
            if (w) {
              canReveal = true;
              status = "Approved, ready to reveal";
              if (r && !r.is_rehearsal) {
                stale = !revealStillValid(r, approved);
                if (!stale) revealedWinner = w.chapterName;
              }
            } else {
              status = "Approved, but no winner in this category";
            }
          }
          return {
            awardId: award.id,
            awardTitle: award.title,
            category,
            categoryLabel: CATEGORY_LABEL[category],
            canReveal,
            status,
            reveal: r ? { at: r.revealed_at, rehearsal: r.is_rehearsal, stale } : null,
            revealedWinner,
          };
        })
      );
    })
  );
  return { cycleName: cycle.name, cells: perAward.flat(), rehearsalCount: reveals.filter((r) => r.is_rehearsal).length };
}

/**
 * Re-checked inside the reveal action, immediately before the write. Returns
 * the approved moderation version, which the reveal row stores.
 */
export async function revealCheck(
  awardId: string,
  category: Category
): Promise<{ ok: true; versionId: string } | { ok: false; error: string }> {
  const cycle = await getCurrentCycle();
  if (!cycle) return { ok: false, error: "There is no current Recognitions cycle." };
  const award = (await listAwards(cycle.id)).find((a) => a.id === awardId);
  if (!award) return { ok: false, error: "This award is not in the current Recognitions cycle." };
  const ctx = newCtx();
  const approved = await approvedResult(ctx, award, cycle);
  if (!approved) return { ok: false, error: "This award is not approved yet, so it cannot be revealed." };
  if (!(await winnerOf(ctx, award.id, approved, category))) {
    return { ok: false, error: "The approved result has no winner in this category." };
  }
  return { ok: true, versionId: approved.versionId };
}

/** For a rehearsal: the award must exist in the current cycle. Nothing else is read. */
export async function awardInCurrentCycle(awardId: string): Promise<boolean> {
  const cycle = await getCurrentCycle();
  if (!cycle) return false;
  return (await listAwards(cycle.id)).some((a) => a.id === awardId);
}

// ---------------------------------------------------------------------------
// A delegate's chapter journey (caller MUST have validated the pass token)
// ---------------------------------------------------------------------------

export type JourneyStage = "nominated" | "checked" | "scoring" | "final_list" | "announced" | "not_forward";

export const STAGE_STEPS: { key: Exclude<JourneyStage, "not_forward">; label: string }[] = [
  { key: "nominated", label: "Nominated" },
  { key: "checked", label: "Checked" },
  { key: "scoring", label: "Being scored" },
  { key: "final_list", label: "Final list" },
  { key: "announced", label: "Winners announced" },
];

export type JourneyItem = {
  awardTitle: string;
  categoryLabel: string;
  stage: JourneyStage;
  /** Only when stage = announced: the revealed winner (public on the hall screen). */
  announced: { winner: string; isYou: boolean } | null;
};

export type Journey =
  | { kind: "no_cycle" }
  | { kind: "no_chapter"; cycleName: string; chapterText: string }
  | {
      kind: "ok";
      cycleName: string;
      chapterName: string;
      categoryLabel: string | null;
      /** null = no nomination deadline set yet. */
      nominationDeadline: string | null;
      nominationsClosed: boolean;
      timeline: { label: string; at: string | null }[];
      items: JourneyItem[];
    };

export async function getChapterJourney(chapterText: string): Promise<Journey> {
  const cycle = await getCurrentCycle();
  if (!cycle) return { kind: "no_cycle" };
  const chapter = await resolveChapter(chapterText);
  if (!chapter) return { kind: "no_chapter", cycleName: cycle.name, chapterText };

  const ctx = newCtx();
  const db = ctx.db;
  const awards = await listAwards(cycle.id);
  const awardIds = awards.map((a) => a.id);
  const [catRes, nomRes, verRes, reveals] = await Promise.all([
    db.from("recognition_chapter_categories").select("category").eq("cycle_id", cycle.id).eq("chapter_id", chapter.id).maybeSingle(),
    awardIds.length
      ? db.from("recognition_nominations").select("award_id, category, status").eq("chapter_id", chapter.id).in("award_id", awardIds)
      : Promise.resolve({ data: [], error: null }),
    awardIds.length
      ? db.from("recognition_moderation_versions").select("award_id").in("award_id", awardIds)
      : Promise.resolve({ data: [], error: null }),
    listReveals(db),
  ]);
  if (catRes.error) fail("read chapter category", catRes.error);
  if (nomRes.error) fail("read chapter nominations", nomRes.error);
  if (verRes.error) fail("read moderation presence", verRes.error);

  const myCategory = (catRes.data as { category: string } | null)?.category;
  const moderated = new Set(((verRes.data ?? []) as { award_id: string }[]).map((v) => v.award_id));
  const realReveals = new Map(reveals.filter((r) => !r.is_rehearsal).map((r) => [`${r.award_id}:${r.category}`, r]));
  const byId = new Map(awards.map((a) => [a.id, a]));
  const nominations = ((nomRes.data ?? []) as { award_id: string; category: string; status: string }[])
    // Drafts are not nominations yet.
    .filter((n) => n.status !== "draft");

  const checksClosed = isPast(cycle.check_deadline) && isPast(cycle.nomination_deadline);
  const items: JourneyItem[] = [];
  for (const n of nominations) {
    const award = byId.get(n.award_id);
    if (!award || !isCategory(n.category)) continue;
    const status = effectiveStatus(
      { status: n.status as "submitted" | "returned" | "checked" | "excluded" | "draft" },
      cycle
    );
    let stage: JourneyStage;
    let announced: JourneyItem["announced"] = null;
    if (status === "excluded") stage = "not_forward";
    else if (status === "submitted" || status === "returned") stage = "nominated";
    else if (moderated.has(award.id) || award.stage2_unlocked_at) stage = "final_list";
    else stage = checksClosed ? "scoring" : "checked";

    const reveal = realReveals.get(`${award.id}:${n.category}`);
    if (reveal && stage !== "not_forward") {
      const approved = await approvedResult(ctx, award, cycle);
      const w = revealStillValid(reveal, approved) ? await winnerOf(ctx, award.id, approved, n.category) : null;
      if (w) {
        stage = "announced";
        announced = { winner: w.chapterName, isYou: w.chapterId === chapter.id };
      }
    }
    items.push({ awardTitle: award.title, categoryLabel: CATEGORY_LABEL[n.category], stage, announced });
  }
  items.sort((a, b) => a.awardTitle.localeCompare(b.awardTitle));

  return {
    kind: "ok",
    cycleName: cycle.name,
    chapterName: chapter.name,
    categoryLabel: isCategory(myCategory) ? CATEGORY_LABEL[myCategory] : null,
    nominationDeadline: cycle.nomination_deadline,
    nominationsClosed: isPast(cycle.nomination_deadline),
    timeline: [
      { label: "Nominations close", at: cycle.nomination_deadline },
      { label: "Checks close", at: cycle.check_deadline },
      { label: "Scoring ends", at: cycle.stage1_deadline },
      { label: "Final list ready", at: cycle.stage2_deadline },
    ],
    items,
  };
}
