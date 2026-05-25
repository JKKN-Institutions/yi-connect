export type EditionStatus = "upcoming" | "registration" | "live" | "post-event" | "archived";
export type MemberCategory = "ec" | "gc" | "nmt" | "general" | "couple";
export type VowCategory = "business" | "family_health" | "yi";
export type VowStatus = "active" | "in_progress" | "completed" | "expired";
export type DossierStatus = "pending" | "generating" | "ready" | "delivered" | "viewed";
export type SessionType = "keynote" | "panel" | "fireside" | "workshop" | "tour" | "peer";
export type FollowUpStatus = "pending" | "sent" | "responded" | "skipped";

export interface Edition {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  theme: string | null;
  host_chapter_id: string | null;
  event_date: string;
  venue: string | null;
  city: string | null;
  expected_attendance: number;
  status: EditionStatus;
  branding: Record<string, unknown>;
  created_at: string;
}

export interface Registrant {
  id: string;
  edition_id: string;
  person_id: string | null;
  chapter_id: string | null;
  access_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  member_category: MemberCategory | null;
  sector: string | null;
  organisation: string | null;
  designation: string | null;
  city: string | null;
  challenges: string[];
  can_offer: Record<string, unknown>;
  cluster_colour: string | null;
  census_complete: boolean;
  is_couple: boolean;
  partner_registrant_id: string | null;
  checked_in: boolean;
  checked_in_at: string | null;
  created_at: string;
}

export interface Match {
  id: string;
  edition_id: string;
  registrant_a: string;
  registrant_b: string;
  match_reason: string | null;
  match_score: number | null;
  slot_time: string | null;
  table_number: number | null;
  is_walkup: boolean;
  a_confirmed: boolean;
  b_confirmed: boolean;
  meeting_happened: boolean;
  notes_a: string | null;
  notes_b: string | null;
  created_at: string;
}

export interface MatchWithPerson extends Match {
  matched_person: Pick<Registrant, "id" | "full_name" | "organisation" | "city" | "sector" | "photo_url" | "phone">;
}

export interface Vow {
  id: string;
  edition_id: string;
  registrant_id: string;
  category: VowCategory;
  vow_text: string;
  witness_id: string | null;
  witness_accepted: boolean;
  status: VowStatus;
  completion_date: string | null;
  completion_notes: string | null;
  tile_engraved: boolean;
  tile_placed: boolean;
  tile_reclaimed: boolean;
  created_at: string;
}

export interface Dossier {
  id: string;
  edition_id: string;
  registrant_id: string;
  top_quotes: unknown[];
  takeaways: unknown[];
  speaker_ranking: unknown[];
  action_plan: unknown[];
  tour_cards: unknown[];
  status: DossierStatus;
  delivered_at: string | null;
  viewed_at: string | null;
  view_count: number;
}

export interface YiFiSession {
  id: string;
  edition_id: string;
  title: string;
  speaker_name: string | null;
  speaker_bio: string | null;
  session_type: SessionType | null;
  start_time: string | null;
  end_time: string | null;
  consent_archiving: boolean;
  themes: string[];
  concepts: unknown[];
}

export interface EventStats {
  total_registrants: number;
  total_capacity_cr: number;
  problem_clusters: number;
  sectors: number;
  introductions_made: number;
  meetings_happened: number;
  vows_made: number;
  witnesses_named: number;
}

export interface RoutingCard {
  registrant: Registrant;
  matches: MatchWithPerson[];
  scheduled_slots: Array<{
    time: string;
    person_name: string;
    table: number;
  }>;
}
