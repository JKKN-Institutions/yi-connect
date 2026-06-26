import "server-only";

// ═══════════════════════════════════════════════════════════════════════
// YIP NATIONAL INTELLIGENCE — Government-of-India TAXONOMY layer
//
// The canonical GoI ministry/scheme tagging vocabulary lives in the new
// `yip.gov_taxonomy` table. This module is the SINGLE read path for it, plus
// the deterministic bridge from the existing committee topics
// (yip.topics WHERE category='committee') to that vocabulary.
//
// Deterministic ONLY — no LLM. The mapping is a string join:
//   committee_name  →  yip.topics.title (category='committee')
//                   →  topics.linked_scheme  (comma-separated schemes)
//   and, in parallel, committee_name → gov_taxonomy.ministry.
//
// Super-admin only (national / cross-event PLATFORM master data). Every getter
// gates with requireSuperAdmin() and returns an empty/safe value on deny so a
// direct import can never leak national rollups to a non-super-admin.
//
// FUTURE AI HOOK: a later classification/verdict layer would enrich each
// taxonomy row (e.g. auto-suggest aliases, dedupe ministries, map free-text
// bill text → scheme). It would WRITE proposals into gov_taxonomy.needs_review
// and never bypass this read path. No LLM is called here today.
// ═══════════════════════════════════════════════════════════════════════

import { createServiceClient } from "@/lib/yip/supabase/server";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";

// ─── Types ──────────────────────────────────────────────────────────────

// One row of the GoI tagging vocabulary. `scheme` is null for a ministry-level
// (parent) row; ministry+scheme together are unique.
export type GovTaxonomyRow = {
  id: string;
  ministry: string;
  scheme: string | null;
  official_name: string | null;
  aliases: string[];
  category: string | null;
  notes: string | null;
  needs_review: boolean;
  sort_order: number | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

// A committee/ministry as it actually appears in the topic catalogue, with its
// linked schemes split out — the deterministic tag a bill/participant inherits.
export type CommitteeMinistryMapping = {
  topic_id: string;
  committee_name: string; // = topics.title for category='committee'
  ministry: string; // same as committee_name (committee title IS the ministry)
  linked_scheme_raw: string | null; // the comma-joined string as stored
  schemes: string[]; // split + trimmed
  description: string | null; // the debate/bill topic for this committee
  // Whether this committee/ministry has a matching gov_taxonomy parent row.
  // false ⇒ surfaces in the "needs taxonomy" gap list for the admin.
  in_taxonomy: boolean;
};

// The shape returned by the loose-cast PostgREST query builder. yip.gov_taxonomy
// is NOT in the generated Database types (additive migration ships with this
// feature), so we read it through a per-call escape-hatch cast — the same idiom
// guests-jury.ts / overview.ts use for tables/schemas not yet in the types.
type LooseSelect = {
  select: (cols: string) => {
    order: (
      col: string,
      opts?: { ascending?: boolean; nullsFirst?: boolean }
    ) => {
      order: (
        col: string,
        opts?: { ascending?: boolean; nullsFirst?: boolean }
      ) => PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown }>;
    };
  };
};

const GOV_TAXONOMY_COLS =
  "id, ministry, scheme, official_name, aliases, category, notes, needs_review, sort_order, is_active, created_at, updated_at";

function mapTaxonomyRow(r: Record<string, unknown>): GovTaxonomyRow {
  return {
    id: String(r.id),
    ministry: String(r.ministry ?? ""),
    scheme: (r.scheme as string | null) ?? null,
    official_name: (r.official_name as string | null) ?? null,
    aliases: Array.isArray(r.aliases) ? (r.aliases as string[]) : [],
    category: (r.category as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    needs_review: Boolean(r.needs_review),
    sort_order: (r.sort_order as number | null) ?? null,
    is_active: r.is_active === undefined ? true : Boolean(r.is_active),
    created_at: (r.created_at as string | null) ?? null,
    updated_at: (r.updated_at as string | null) ?? null,
  };
}

/** Split a stored linked_scheme string ("NEP 2020, PM eVidya") into parts. */
export function splitSchemes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ─── Reads ──────────────────────────────────────────────────────────────

/**
 * Full GoI taxonomy vocabulary, ordered for display (sort_order, then
 * ministry, then scheme). Super-admin only; returns [] on deny or empty table.
 *
 * `includeInactive` defaults false so the editor / panels see only live rows;
 * the admin edit table passes true to manage soft-deleted entries.
 */
export async function getGovTaxonomy(opts?: {
  includeInactive?: boolean;
}): Promise<GovTaxonomyRow[]> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return [];

  const svc = await createServiceClient();
  const table = svc.from("gov_taxonomy" as never) as unknown as LooseSelect;

  const { data, error } = await table
    .select(GOV_TAXONOMY_COLS)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("ministry", { ascending: true });

  if (error || !data) return [];
  const rows = data.map(mapTaxonomyRow);
  return opts?.includeInactive ? rows : rows.filter((r) => r.is_active);
}

type CommitteeTopicSelect = {
  select: (cols: string) => {
    eq: (
      k: string,
      v: unknown
    ) => {
      eq: (
        k: string,
        v: unknown
      ) => {
        order: (
          c: string
        ) => PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown }>;
      };
    };
  };
};

/**
 * The deterministic committee→ministry→scheme bridge.
 *
 * Reads the active committee rows from yip.topics (title = ministry,
 * linked_scheme = its schemes) and marks which have a matching gov_taxonomy
 * parent ministry row. This is the join the corpus layer uses to tag every
 * bill/participant by committee_name — NO LLM, pure string match on title.
 *
 * Super-admin only; returns [] on deny.
 */
export async function getCommitteeMinistryMap(): Promise<CommitteeMinistryMapping[]> {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return [];

  const svc = await createServiceClient();

  const topicsTable = svc.from("topics") as unknown as CommitteeTopicSelect;
  const { data: topicRows, error } = await topicsTable
    .select("id, title, linked_scheme, description")
    .eq("category", "committee")
    .eq("is_active", true)
    .order("title");

  if (error || !topicRows) return [];

  // Set of ministries that have a parent (scheme IS NULL) gov_taxonomy row, so
  // the gap list can flag committees not yet represented in the taxonomy.
  const taxonomy = await getGovTaxonomy({ includeInactive: false });
  const ministrySet = new Set(
    taxonomy.map((t) => normalizeMinistry(t.ministry))
  );

  return topicRows.map((row) => {
    const committee = String(row.title ?? "").trim();
    const linkedRaw = (row.linked_scheme as string | null) ?? null;
    return {
      topic_id: String(row.id),
      committee_name: committee,
      ministry: committee,
      linked_scheme_raw: linkedRaw,
      schemes: splitSchemes(linkedRaw),
      description: (row.description as string | null) ?? null,
      in_taxonomy: ministrySet.has(normalizeMinistry(committee)),
    };
  });
}

/**
 * Build a fast lookup: committee_name (normalized) → its mapping. The corpus
 * layer calls getCommitteeMinistryMap() once and indexes it with this so each
 * bill/participant committee_name resolves to ministry + schemes in O(1).
 */
export function indexByCommittee(
  rows: CommitteeMinistryMapping[]
): Map<string, CommitteeMinistryMapping> {
  const m = new Map<string, CommitteeMinistryMapping>();
  for (const r of rows) m.set(normalizeMinistry(r.committee_name), r);
  return m;
}

/**
 * Canonical key for matching free-text committee/ministry names across tables.
 * Committee names are hand-typed in a few places, so we lower-case, collapse
 * whitespace, and strip a leading "ministry of " so "Ministry of Education" and
 * "education" land on the same bucket. Deterministic; the future AI layer can
 * replace this with alias resolution against gov_taxonomy.aliases.
 */
export function normalizeMinistry(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^ministry of\s+/, "")
    .replace(/[.]/g, "")
    .trim();
}
