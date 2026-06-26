// ═══════════════════════════════════════════════════════════════════════
// YIP NATIONAL INTELLIGENCE — taxonomy ACTION types (non-action module).
//
// A "use server" file may export ONLY async functions, so the input/result
// types for the gov_taxonomy actions live here and are imported by both
// app/yip/actions/national-taxonomy.ts and the admin client. Pure types — no
// runtime, no "server-only" (the client imports these too).
// ═══════════════════════════════════════════════════════════════════════

// Standard server-action envelope used across the YIP admin actions.
export type TaxonomyActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// The editable shape of one gov_taxonomy row, as the admin form submits it.
// `scheme` empty/undefined ⇒ a ministry-parent row. The action trims + nulls
// blank strings and de-dupes aliases before writing.
export type TaxonomyInput = {
  ministry: string;
  scheme?: string | null;
  official_name?: string | null;
  aliases?: string[];
  category?: string | null;
  notes?: string | null;
  needs_review?: boolean;
  sort_order?: number | null;
};
