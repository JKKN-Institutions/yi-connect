import { z } from "zod";
import { TP_TAGS } from "./constants";

/*
 * Delegate profile: shared constants, the save schema and the profile type.
 * No server imports here, so the profile form (a client component) can use
 * the same limits the server enforces. Database reads live in ./directory.ts.
 */

/** Yi verticals, used for "my Yi vertical" and the chapter strengths / wants chips. */
export const YI_VERTICALS = [
  "Membership",
  "Learning",
  "Climate Change",
  "Health",
  "Road Safety",
  "Rural Initiatives",
  "Innovation & Entrepreneurship",
  "Sports",
  "Masoom",
  "Thalir",
  "Yuva",
  "Accessibility",
  "Branding",
] as const;

export type YiVertical = (typeof YI_VERTICALS)[number];

/** Max characters for working on / ask me about / pledge (the column CHECK says the same). */
export const PROFILE_TEXT_MAX = 140;
/** Max needs / offers tags. */
export const PROFILE_TAG_MAX = 5;
/** Max chapter strengths / chapter wants chips. */
export const PROFILE_CHAPTER_MAX = 3;

/** Trim, fold runs of spaces and line breaks into one space, empty becomes null. */
const shortText = (label: string) =>
  z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().max(PROFILE_TEXT_MAX, `Keep "${label}" under ${PROFILE_TEXT_MAX} characters`))
    .transform((s) => (s === "" ? null : s));

const verticalList = (what: string) =>
  z
    .array(z.enum(YI_VERTICALS, { message: "Pick from the Yi verticals list" }))
    .max(PROFILE_CHAPTER_MAX, `Pick up to ${PROFILE_CHAPTER_MAX} things your chapter ${what}`)
    .transform((xs) => [...new Set(xs)]);

export const ProfileSchema = z.object({
  needs: z
    .array(z.enum(TP_TAGS, { message: "Pick from the list" }))
    .max(PROFILE_TAG_MAX, `Pick up to ${PROFILE_TAG_MAX} things you need`)
    .transform((xs) => [...new Set(xs)]),
  offers: z
    .array(z.enum(TP_TAGS, { message: "Pick from the list" }))
    .max(PROFILE_TAG_MAX, `Pick up to ${PROFILE_TAG_MAX} things you offer`)
    .transform((xs) => [...new Set(xs)]),
  partner_meetings_opt_in: z.boolean(),
  delegate_meetings_opt_in: z.boolean(),
  working_on: shortText("What I am working on"),
  ask_me_about: shortText("Ask me about"),
  pledge: shortText("My 1% pledge"),
  yi_vertical: z.enum(YI_VERTICALS, { message: "Pick a Yi vertical from the list" }).nullable(),
  chapter_strengths: verticalList("does well"),
  chapter_wants: verticalList("wants help with"),
  directory_visible: z.boolean(),
});

export type ProfileInput = z.input<typeof ProfileSchema>;

/** One delegate as their own profile page sees them (never sent to anyone else). */
export type TpDelegateProfile = {
  id: string;
  token: string;
  full_name: string;
  chapter: string;
  zone: string;
  business_name: string | null;
  industry: string;
  role_title: string | null;
  needs: string[];
  offers: string[];
  partner_meetings_opt_in: boolean;
  delegate_meetings_opt_in: boolean;
  is_sample: boolean;
  working_on: string | null;
  ask_me_about: string | null;
  yi_vertical: string | null;
  pledge: string | null;
  chapter_strengths: string[];
  chapter_wants: string[];
  directory_visible: boolean;
};

/** Keep only values still on a list, so an old value never blocks saving. */
export function onList<T extends string>(values: string[] | null | undefined, list: readonly T[]): T[] {
  return (values ?? []).filter((v): v is T => (list as readonly string[]).includes(v));
}
