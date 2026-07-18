// Canonical TypeScript types for the YiFi Community ("YIBE Corner") board.
// Shapes mirror the SECURITY DEFINER RPCs in
// supabase/migrations/20260704100000_yifi_community.sql exactly.
// UI/action agents import from '@/lib/yifi/community/types'.
//
// Anonymity note: `author_name` / `author_registrant_id` are returned as null
// by the member-facing read RPCs when a post/reply is anonymous and the viewer
// is not the author. Admin RPCs return the real author (unmasked).

export type PostType = "challenge" | "best_practice" | "industry";
export type PostStatus = "draft" | "published" | "hidden" | "removed";
export type NotificationKind = "new_reply" | "best_answer" | "helper_suggestion";
export type FlagStatus = "open" | "resolved" | "dismissed";

// A post as returned by yifi_community_list_posts / the `post` field of
// yifi_community_get_post. `author_name`/`author_registrant_id` are null when
// anonymous (and, in get_post, the viewer is not the author).
export interface CommunityPost {
  id: string;
  edition_id: string;
  author_registrant_id: string | null;
  post_type: PostType;
  title: string;
  body: string;
  sector: string | null;
  is_anonymous: boolean;
  status: PostStatus;
  is_seeded: boolean;
  source_challenge: string | null;
  best_reply_id: string | null;
  reply_count: number;
  upvote_count: number;
  author_name: string | null;
  created_at: string;
  // present in list_posts rows (true when best_reply_id is set)
  has_best?: boolean;
  updated_at?: string;
}

// A reply as returned inside yifi_community_get_post.
export interface CommunityReply {
  id: string;
  post_id: string;
  body: string;
  author_name: string | null;
  is_anonymous: boolean;
  upvote_count: number;
  is_best: boolean;
  viewer_upvoted: boolean;
  created_at: string;
}

// Full return shape of yifi_community_get_post.
export interface CommunityPostDetail {
  post: CommunityPost;
  replies: CommunityReply[];
  is_viewer_author: boolean;
}

// A row from yifi_community_list_my_drafts.
export interface CommunityDraft {
  id: string;
  edition_id: string;
  post_type: PostType;
  title: string;
  body: string;
  sector: string | null;
  is_anonymous: boolean;
  source_challenge: string | null;
  created_at: string;
}

// A row from yifi_community_my_notifications.
export interface CommunityNotification {
  id: string;
  kind: NotificationKind;
  post_id: string | null;
  post_title: string | null;
  is_read: boolean;
  created_at: string;
}

// A row from yifi_community_suggest_helpers.
export interface HelperSuggestion {
  id: string;
  full_name: string;
  sector: string | null;
  organisation: string | null;
}

// A row from yifi_community_admin_list_posts (real author, unmasked).
export interface AdminCommunityPost {
  id: string;
  edition_id: string;
  author_registrant_id: string;
  author_name: string | null;
  post_type: PostType;
  title: string;
  body: string;
  sector: string | null;
  is_anonymous: boolean;
  status: PostStatus;
  is_seeded: boolean;
  source_challenge: string | null;
  best_reply_id: string | null;
  reply_count: number;
  upvote_count: number;
  created_at: string;
}

// A row from yifi_community_admin_list_flags.
export interface AdminCommunityFlag {
  id: string;
  reason: string | null;
  status: FlagStatus;
  created_at: string;
  post_id: string | null;
  reply_id: string | null;
  flagger_name: string | null;
  content_type: "post" | "reply";
  content_title: string | null;
  content_text: string | null;
  author_name: string | null;
  author_is_anonymous: boolean | null;
}

// Return shape of yifi_community_admin_real_author.
export interface RealAuthor {
  registrant_id: string;
  full_name: string;
  email: string | null;
}
