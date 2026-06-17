/**
 * YiFi Dossier Engine — shared types.
 *
 * Plain module (NOT "use server") so it can export types + constants that the
 * engine, prompt builder, delivery helper, server actions, and admin UI all
 * share. A "use server" file may export ONLY async functions — keep these here.
 */

// ── Engine model constant ──────────────────────────────────────────────────
/** Claude model used by the dossier generation engine. */
export const DOSSIER_MODEL = "claude-sonnet-4-6";

/** Max characters of transcript per session fed into the prompt (token budget). */
export const TRANSCRIPT_EXCERPT_CHARS = 4000;

/** Max sessions included in a single prompt (token budget). */
export const MAX_SESSIONS_IN_PROMPT = 30;

/** Number of dated action-plan items the prompt asks Claude to return. */
export const ACTION_PLAN_ITEMS = 8;

/** Max concurrent dossier generations in generateAllDossiers (rate-limit guard). */
export const GENERATE_CONCURRENCY = 3;

// ── Input shapes (mirror the read RPCs) ─────────────────────────────────────

/** A registrant's census vector, as returned by yifi_get_registrants_for_dossier. */
export interface DossierRegistrantInput {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  sector: string | null;
  organisation: string | null;
  designation: string | null;
  city: string | null;
  challenges: string[] | null;
  can_offer: Record<string, unknown> | unknown[] | null;
  census_complete: boolean | null;
}

/** A session's raw material, as returned by yifi_get_edition_sessions. */
export interface DossierSessionInput {
  id: string;
  title: string | null;
  speaker_name: string | null;
  session_type: string | null;
  themes: string[] | null;
  concepts: Record<string, unknown> | unknown[] | null;
  transcript_url: string | null;
  transcript_text: string | null;
}

// ── Output shape (the dossier content Claude returns) ───────────────────────

export interface DossierQuote {
  quote: string;
  speaker: string;
  session_title: string;
  why_relevant: string;
}

export interface DossierTakeaway {
  session_title: string;
  takeaway: string;
}

export interface DossierSpeakerRank {
  speaker: string;
  reason: string;
}

export interface DossierActionItem {
  day_offset: number;
  action: string;
}

/** The full JSON contract the engine expects back from Claude. */
export interface DossierContent {
  top_quotes: DossierQuote[];
  takeaways: DossierTakeaway[];
  speaker_ranking: DossierSpeakerRank[];
  action_plan: DossierActionItem[];
  tour_cards: unknown[];
}

// ── Result shapes ───────────────────────────────────────────────────────────

export interface GenerateOneResult {
  ok: boolean;
  error?: string;
}

export interface GenerateAllResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: string[];
}

export interface DeliverResult {
  ok: boolean;
  error?: string;
}

// ── Server-action result shapes ─────────────────────────────────────────────
// Kept here (not in the "use server" actions file) so that file exports ONLY
// async functions, per the project's hard rule.

export interface GenerationActionResult {
  ok: boolean;
  error?: string;
  summary?: GenerateAllResult;
}

export type DeliverActionResult = DeliverResult;
