import "server-only";

import { z } from "zod";
import type { tpService } from "./supabase";
import { TP_ZONES } from "./constants";
import { delegateKey, normaliseIndustry } from "./import";
import { newBadgeSecret } from "./connections";
import { NAME_INDEX, pickBadgeCodes, usedBadgeCodes } from "@/app/take-pride/desk/delegates/_core";

type SupabaseClient = ReturnType<typeof tpService>;

/*
 * Walk-ins added at the help desk by an organiser (Director, 10 Oct).
 * NOT a "use server" file and NOT gated: the caller
 * (app/take-pride/desk/delegates/actions.ts) must pass requireTpOrganiser()
 * first. Review mode never reaches this: a walk-in is always a REAL delegate.
 *
 * Same shape as an imported delegate: random badge number + badge secret,
 * partner meetings OFF until they switch them on, listed in the delegate
 * directory (set explicitly on insert). The organiser must tick that they
 * checked the payment proof; nothing is saved without it.
 */

const clean = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().max(max));

export const WalkInSchema = z.object({
  full_name: clean(120).pipe(z.string().min(2, "Enter the delegate's full name")),
  chapter: clean(80).pipe(z.string().min(2, "Enter their Yi chapter")),
  zone: z.enum(TP_ZONES, { message: "Pick a zone" }),
  business_name: clean(120).optional().default(""),
  role_title: clean(80).optional().default(""),
  industry: clean(80).optional().default(""),
  phone: z
    .string()
    .optional()
    .default("")
    .transform((s) => s.replace(/[^\d+]/g, ""))
    .refine((s) => s === "" || s.replace(/\D/g, "").length >= 10, "Enter a 10-digit mobile number, or leave it empty"),
  email: z
    .string()
    .optional()
    .default("")
    .transform((s) => s.trim().toLowerCase())
    .refine((s) => s === "" || z.string().email().max(160).safeParse(s).success, "Enter a valid email, or leave it empty"),
  payment_checked: z.literal(true, { message: "Tick the box once you have checked their payment proof" }),
});

export type WalkInResult = {
  /** true = the same name + chapter was already a real delegate: nothing was added. */
  existing: boolean;
  id: string;
  token: string;
  badge_code: string;
  full_name: string;
  chapter: string;
};

const COLS = "id, token, badge_code, full_name, chapter";

/** The real delegate with this name + chapter (same rule as the unique index), or null. */
export async function findRealDelegate(db: SupabaseClient, fullName: string, chapter: string): Promise<WalkInResult | null> {
  const key = delegateKey(fullName, chapter);
  // Loose match on BOTH name and chapter in the DB (so a short or common name
  // cannot push the real row past the limit), exact delegateKey match here.
  // LIKE wildcards are stripped from both.
  const loose = (s: string) => `%${s.replace(/[%_*\\]/g, "").trim().split(/\s+/).join("%")}%`;
  const { data, error } = await db
    .from("tp_delegates")
    .select(COLS)
    .eq("is_sample", false)
    .ilike("full_name", loose(fullName))
    .ilike("chapter", loose(chapter))
    .order("id")
    .limit(1000);
  if (error) throw new Error(error.message);
  const hit = (data ?? []).find((d) => delegateKey(d.full_name, d.chapter) === key);
  return hit ? { existing: true, ...(hit as Omit<WalkInResult, "existing">) } : null;
}

/** Adds one real delegate, or returns the one already listed under the same name + chapter. */
export async function createWalkIn(
  db: SupabaseClient,
  v: z.output<typeof WalkInSchema>
): Promise<{ ok: true; data: WalkInResult } | { ok: false; error: string }> {
  const already = await findRealDelegate(db, v.full_name, v.chapter);
  if (already) return { ok: true, data: already };

  for (let attempt = 0; attempt < 4; attempt++) {
    const codes = pickBadgeCodes(1, await usedBadgeCodes(db));
    if (!codes) return { ok: false, error: "No free badge numbers left (TP26-1000 to TP26-9999 are all used)." };
    const { data, error } = await db
      .from("tp_delegates")
      .insert({
        badge_code: codes[0],
        badge_secret: newBadgeSecret(),
        full_name: v.full_name,
        chapter: v.chapter,
        zone: v.zone,
        business_name: v.business_name || null,
        role_title: v.role_title || null,
        industry: normaliseIndustry(v.industry).industry,
        phone: v.phone || null,
        email: v.email || null,
        needs: [],
        offers: [],
        // The DB default is ON (set for sample rows); real delegates choose.
        partner_meetings_opt_in: false,
        // Listed by default (Director, 10 Oct); set here so it does not depend
        // on the DB default (take_pride_05).
        directory_visible: true,
        is_sample: false,
      })
      .select(COLS)
      .single();
    if (!error && data) return { ok: true, data: { existing: false, ...(data as Omit<WalkInResult, "existing">) } };
    if (error?.code !== "23505") return { ok: false, error: "Could not add the walk-in. Please try again." };
    if (error.message.includes(NAME_INDEX)) {
      // Another organiser added the same person a moment ago.
      const now = await findRealDelegate(db, v.full_name, v.chapter);
      if (now) return { ok: true, data: now };
      return { ok: false, error: "Could not add the walk-in. Please try again." };
    }
    // Any other 23505 = the badge number was taken meanwhile: pick again.
  }
  return { ok: false, error: "Badge numbers kept clashing. Please try again." };
}
