/**
 * Shared types for Yi-Future announcement actions. Lives outside the
 * "use server" file so non-function exports are allowed.
 */

export type AnnouncementAudience =
  | "everyone"
  | "chapter"
  | "team"
  | "delegate"
  | "zone";
export type AnnouncementAuthorScope = "chapter" | "national";

export type AnnouncementResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

// useActionState state for the composer (null = untouched).
export type ComposerState = AnnouncementResult | null;

// One announcement as a delegate sees it on their dashboard.
export type DelegateAnnouncement = {
  id: string;
  title: string;
  body: string;
  url: string | null;
  author_name: string | null;
  author_scope: AnnouncementAuthorScope;
  audience: AnnouncementAudience;
  created_at: string;
  read: boolean;
};

export type DelegateAnnouncementFeed = {
  items: DelegateAnnouncement[];
  unread: number;
};

// A row as an admin sees it in the "sent" history.
export type SentAnnouncement = {
  id: string;
  title: string;
  body: string;
  url: string | null;
  audience: AnnouncementAudience;
  author_name: string | null;
  author_scope: AnnouncementAuthorScope;
  chapter_id: string | null;
  team_id: string | null;
  delegate_id: string | null;
  zone: string | null;
  /** How many delegates have opened it (from announcement_reads). */
  read_count: number;
  created_at: string;
};
