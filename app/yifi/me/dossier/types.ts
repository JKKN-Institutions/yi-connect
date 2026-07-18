// Local types for the YiFi member dossier content shape.
// Produced by the dossier generation engine and stored as JSONB on
// yifi.dossiers; every field may be missing — consumers must code defensively.

export interface DossierQuote {
  quote?: string | null;
  speaker?: string | null;
  session_title?: string | null;
  why_relevant?: string | null;
}

export interface DossierTakeaway {
  session_title?: string | null;
  takeaway?: string | null;
}

export interface DossierSpeakerRank {
  speaker?: string | null;
  reason?: string | null;
}

export interface DossierActionItem {
  day_offset?: number | null;
  action?: string | null;
}

export interface DossierTourCard {
  title?: string | null;
  description?: string | null;
  // tour_cards shape is open-ended; keep extras addressable.
  [key: string]: unknown;
}

// The dossier row returned by public.yifi_get_dossier (row_to_json).
export interface DossierRow {
  id?: string;
  edition_id?: string;
  registrant_id?: string;
  top_quotes?: DossierQuote[] | null;
  takeaways?: DossierTakeaway[] | null;
  speaker_ranking?: DossierSpeakerRank[] | null;
  action_plan?: DossierActionItem[] | null;
  tour_cards?: DossierTourCard[] | null;
  status?: string | null;
  delivered_at?: string | null;
  viewed_at?: string | null;
  view_count?: number | null;
}

// Statuses for which we render the full dossier (vs. the not-ready state).
export const READY_STATUSES = ["ready", "delivered", "viewed"] as const;
