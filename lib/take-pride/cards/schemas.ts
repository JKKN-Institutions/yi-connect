import { z } from "zod";

/*
 * Business-card scan: limits, the photo guard, image-size maths and the
 * contact validator. Shared by the browser (downscale), the server action
 * (upload guard, edits) and the routine drain (what the routine POSTs back).
 *
 * No server imports and no relative imports, so a node script can unit-check
 * everything here directly.
 *
 * The production app NEVER calls an LLM. A delegate's photo is queued in
 * tp_card_scans; the claude.ai routine reads it off-platform and POSTs the
 * printed fields back. The photo is deleted as soon as it has been read.
 */

/** Scans a delegate may start per India calendar day (every scan counts, failed ones too). */
export const CARD_DAILY_LIMIT = 30;
/** Longest side of the photo after downscaling in the browser. */
export const CARD_MAX_SIDE = 1280;
/** First JPEG quality tried; lower steps follow while the photo is over the target. */
export const CARD_JPEG_QUALITY = 0.8;
export const CARD_QUALITY_STEPS = [0.8, 0.7, 0.6, 0.5] as const;
/** Aim for photos under this size. */
export const CARD_TARGET_BYTES = 300 * 1024;
/** Hard cap after compression, enforced in the browser AND on the server. */
export const CARD_MAX_BYTES = 2 * 1024 * 1024;
/** Routine claim batch. */
export const CARD_CLAIM_BATCH = 5;
/** Keep one GET response well under Vercel's 4.5 MB body limit (base64 characters). */
export const CARD_RESPONSE_BUDGET = 3_400_000;
export const CARD_STALE_MINUTES = 15;
/** A photo not read within this many hours is deleted and the scan fails. */
export const CARD_EXPIRE_HOURS = 24;

export const CARD_FIELD_MAX = {
  full_name: 120,
  title: 120,
  company: 160,
  phone: 40,
  email: 160,
  website: 200,
  city: 80,
  note: 500,
} as const;

export const CARD_FIELDS = ["full_name", "title", "company", "phone", "email", "website", "city", "note"] as const;
export type CardField = (typeof CARD_FIELDS)[number];
export type CardContactFields = Record<CardField, string | null>;

// ------------------------------------------------------------ image ----

/** Width and height that fit inside max x max, keeping the shape. Never upscales. */
export function fitWithin(width: number, height: number, max: number = CARD_MAX_SIDE): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const long = Math.max(width, height);
  if (long <= max) return { width: Math.round(width), height: Math.round(height) };
  const k = max / long;
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

/** Bytes a base64 string decodes to (padding aware). */
export function base64Bytes(b64: string): number {
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

export type PhotoCheck = { ok: true; b64: string; bytes: number } | { ok: false; error: string };

/**
 * Server-side guard for an uploaded card photo: strips a data-URL prefix,
 * then requires strict base64, a JPEG header (base64 of FF D8 FF starts
 * "/9j/") and at most CARD_MAX_BYTES once decoded.
 */
export function checkCardPhoto(input: unknown): PhotoCheck {
  if (typeof input !== "string" || !input) return { ok: false, error: "No photo was sent. Take the photo again." };
  // Reject before any regex runs on a huge string.
  if (input.length > Math.ceil(CARD_MAX_BYTES / 3) * 4 + 64) {
    return { ok: false, error: "That photo is too large. Take it again a little further from the card." };
  }
  const b64 = input.replace(/^data:image\/jpeg;base64,/, "");
  if (b64.length % 4 !== 0 || !B64.test(b64)) return { ok: false, error: "That photo could not be read. Take it again." };
  if (!b64.startsWith("/9j/")) return { ok: false, error: "That photo could not be read. Take it again." };
  const bytes = base64Bytes(b64);
  if (bytes > CARD_MAX_BYTES) return { ok: false, error: "That photo is too large. Take it again a little further from the card." };
  if (bytes < 1024) return { ok: false, error: "That photo is too small to read. Take it again." };
  return { ok: true, b64, bytes };
}

// ----------------------------------------------------------- fields ----

const EMAIL_IN_TEXT = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_IN_TEXT = /(?:\+?\d[\d\s-]{8,}\d)/g;

/** Free text: control characters stripped, whitespace folded, phone numbers and emails replaced with [removed]. */
export function scrubText(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(EMAIL_IN_TEXT, "[removed]")
    .replace(PHONE_IN_TEXT, (m) => (m.replace(/\D/g, "").length >= 10 ? "[removed]" : m))
    .replace(/\s+/g, " ")
    .trim();
}

/** Control characters stripped and whitespace folded, nothing else changed. */
export function foldText(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const PHONE = /^\+?[0-9(][0-9 ()\-./]*[0-9]$/;
export function isPhone(s: string): boolean {
  if (s.length < 7 || s.length > CARD_FIELD_MAX.phone || !PHONE.test(s)) return false;
  const digits = s.replace(/\D/g, "").length;
  return digits >= 7 && digits <= 15;
}

const EMAIL = /^[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}$/i;
export function isEmail(s: string): boolean {
  return s.length <= CARD_FIELD_MAX.email && EMAIL.test(s);
}

const WEBSITE = /^(?:https?:\/\/)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d{2,5})?(?:[/?#][^\s<>"']*)?$/i;
export function isWebsite(s: string): boolean {
  return s.length <= CARD_FIELD_MAX.website && WEBSITE.test(s);
}

/** A safe http(s) href for a stored website, or null. Never another scheme. */
export function websiteHref(s: string | null | undefined): string | null {
  if (!s || !isWebsite(s)) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

const raw = z.string().max(5000).nullable().optional();
const RawContact = z.object({
  full_name: raw,
  title: raw,
  company: raw,
  phone: raw,
  email: raw,
  website: raw,
  city: raw,
  note: raw,
});

export type ContactCheck =
  | { ok: true; contact: CardContactFields; dropped: CardField[] }
  | { ok: false; error: string };

/**
 * Check one contact.
 *  - mode "routine": what the routine read off a card. A field in the wrong
 *    format or too long is DROPPED (left empty) and named in `dropped`, so one
 *    misread does not lose the whole card. Fails only on a bad shape or when
 *    nothing usable is left.
 *  - mode "edit": what the delegate typed. Any bad field is an error with a
 *    plain message.
 * Phone and email are checked by format and never scrubbed. In routine mode
 * every other field is model text and has phones and emails replaced with
 * [removed]. Never throws.
 */
export function validateContact(input: unknown, mode: "routine" | "edit"): ContactCheck {
  const p = RawContact.safeParse(input ?? {});
  if (!p.success) return { ok: false, error: "contact: " + (p.error.issues[0]?.message ?? "bad shape") };
  const out = {} as CardContactFields;
  const dropped: CardField[] = [];
  const LABEL: Record<CardField, string> = {
    full_name: "Name",
    title: "Title",
    company: "Company",
    phone: "Phone",
    email: "Email",
    website: "Website",
    city: "City",
    note: "Note",
  };

  for (const f of CARD_FIELDS) {
    const v = p.data[f];
    const t = typeof v === "string" ? v.trim() : "";
    if (!t) {
      out[f] = null;
      continue;
    }
    let value: string | null;
    let problem: string | null = null;
    if (f === "phone") {
      value = t.replace(/\s+/g, " ");
      if (!isPhone(value)) problem = "Phone should be a number like +91 98765 43210";
    } else if (f === "email") {
      value = t.toLowerCase();
      if (!isEmail(value)) problem = "Email does not look right";
    } else if (f === "website") {
      value = t.replace(/\s+/g, "");
      if (!isWebsite(value)) problem = "Website does not look right, for example example.com";
    } else {
      // Model text has phones and emails removed; a delegate's own edits are only folded.
      value = mode === "routine" ? scrubText(t) : foldText(t);
      if (value.length > CARD_FIELD_MAX[f]) problem = `${LABEL[f]} is too long (max ${CARD_FIELD_MAX[f]} characters)`;
    }
    if (!problem && value && value.length > CARD_FIELD_MAX[f]) problem = `${LABEL[f]} is too long`;
    if (problem) {
      if (mode === "edit") return { ok: false, error: problem };
      dropped.push(f);
      out[f] = null;
      continue;
    }
    out[f] = value || null;
  }

  if (!out.full_name && !out.company && !out.phone && !out.email) {
    return {
      ok: false,
      error: mode === "edit" ? "Keep at least a name, company, phone or email." : "contact: nothing usable after checks",
    };
  }
  return { ok: true, contact: out, dropped };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isCardId(s: unknown): s is string {
  return typeof s === "string" && UUID.test(s);
}

/** Start of today in India (IST, UTC+5:30), as an ISO string. The daily limit resets here. */
export function istDayStartIso(now: Date = new Date()): string {
  const IST = 330 * 60 * 1000;
  const shifted = new Date(now.getTime() + IST);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - IST).toISOString();
}
