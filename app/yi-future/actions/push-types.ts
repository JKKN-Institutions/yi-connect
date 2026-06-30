/**
 * Shared types for push actions. Lives outside the "use server" file so
 * TypeScript/Next doesn't reject non-function exports.
 */

export type PushSubjectType =
  | "auth_user"
  | "delegate"
  | "jury"
  | "mentor"
  | "partner"
  | "expert";

export type SaveSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export type PushSaveResult = { ok: true } | { ok: false; error: string };
