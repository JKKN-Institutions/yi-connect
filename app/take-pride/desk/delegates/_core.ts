import "server-only";

import { randomInt } from "node:crypto";
import type { tpService } from "@/lib/take-pride/supabase";
import { delegateKey, type TpImportRow, type TpImportSkip } from "@/lib/take-pride/import";
import { newBadgeSecret } from "@/lib/take-pride/connections";

type SupabaseClient = ReturnType<typeof tpService>;

/*
 * Database side of the delegate import. NOT a "use server" file and NOT
 * gated: every caller (./actions.ts) must pass requireTpOrganiser() first.
 * Kept apart from the actions so the write path can be checked directly.
 */

const PAGE = 1000; // PostgREST returns at most 1000 rows per request.
const CHUNK = 200;

async function pageAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

async function existingRealKeys(db: SupabaseClient): Promise<Set<string>> {
  const rows = await pageAll<{ full_name: string; chapter: string }>((a, b) =>
    db.from("tp_delegates").select("full_name, chapter").eq("is_sample", false).order("id").range(a, b)
  );
  return new Set(rows.map((r) => delegateKey(r.full_name, r.chapter)));
}

export async function usedBadgeCodes(db: SupabaseClient): Promise<Set<string>> {
  const rows = await pageAll<{ badge_code: string }>((a, b) => db.from("tp_delegates").select("badge_code").order("id").range(a, b));
  return new Set(rows.map((r) => r.badge_code));
}

/**
 * Random, unused badge numbers ("TP26-" + 4 digits, the badge_code column).
 * Digits come from crypto, not a counter. The number alone is still
 * guessable, so each row also gets a badge_secret (newBadgeSecret) that is
 * printed after it ("TP26-1234-K7QXM") and required by partner lead capture
 * and scan-to-connect (lib/take-pride/badge.ts).
 */
export function pickBadgeCodes(n: number, used: Set<string>): string[] | null {
  const free: string[] = [];
  for (let d = 1000; d <= 9999; d++) {
    const c = `TP26-${d}`;
    if (!used.has(c)) free.push(c);
  }
  if (free.length < n) return null;
  // Partial Fisher-Yates with crypto randomness.
  for (let i = 0; i < n; i++) {
    const j = i + randomInt(free.length - i);
    [free[i], free[j]] = [free[j], free[i]];
  }
  return free.slice(0, n);
}

export type TpImportPlan = { toInsert: TpImportRow[]; alreadyListed: TpImportSkip[] };

/** Splits mapped rows into new ones and ones already in the real list. */
export async function planImport(db: SupabaseClient, rows: TpImportRow[]): Promise<TpImportPlan> {
  const existing = await existingRealKeys(db);
  const toInsert: TpImportRow[] = [];
  const alreadyListed: TpImportSkip[] = [];
  for (const r of rows) {
    if (existing.has(delegateKey(r.full_name, r.chapter))) {
      alreadyListed.push({ line: r.line, name: r.full_name, reason: "Already in the delegate list (same name and chapter)" });
    } else toInsert.push(r);
  }
  return { toInsert, alreadyListed };
}

export type TpImportOutcome = { inserted: number; ids: string[]; alreadyListed: TpImportSkip[]; error: string | null };

/** Unique index (migration take_pride_03) on name + chapter of real delegates. */
export const NAME_INDEX = "tp_delegates_real_name_chapter_key";

export async function runImport(db: SupabaseClient, rows: TpImportRow[]): Promise<TpImportOutcome> {
  const { toInsert, alreadyListed } = await planImport(db, rows);
  const ids: string[] = [];
  for (let start = 0; start < toInsert.length; start += CHUNK) {
    let chunk = toInsert.slice(start, start + CHUNK);
    let done = false;
    for (let attempt = 0; attempt < 4 && !done; attempt++) {
      if (chunk.length === 0) {
        done = true;
        break;
      }
      const codes = pickBadgeCodes(chunk.length, await usedBadgeCodes(db));
      if (!codes) {
        return { inserted: ids.length, ids, alreadyListed, error: "No free badge numbers left (TP26-1000 to TP26-9999 are all used)." };
      }
      const { data, error } = await db
        .from("tp_delegates")
        .insert(
          chunk.map((r, i) => ({
            badge_code: codes[i],
            badge_secret: newBadgeSecret(),
            full_name: r.full_name,
            chapter: r.chapter,
            zone: r.zone,
            business_name: r.business_name,
            industry: r.industry,
            role_title: r.role_title,
            // Stored for "My people": shown only to a mutual connection, and
            // only when both delegates turn on share_contact (default off).
            phone: r.phone,
            email: r.email,
            needs: [],
            offers: [],
            // The DB default is the opposite (it was set for sample rows).
            // directory_visible is left to the DB default (listed; take_pride_05).
            partner_meetings_opt_in: false,
            is_sample: false,
          }))
        )
        .select("id");
      if (!error) {
        ids.push(...(data ?? []).map((d) => d.id as string));
        done = true;
      } else if (error.code !== "23505") {
        return { inserted: ids.length, ids, alreadyListed, error: `Saving stopped after ${ids.length} delegates: ${error.message}` };
      } else if (error.message.includes(NAME_INDEX)) {
        // Someone else saved some of these delegates meanwhile (another tab or
        // organiser). The whole chunk was rejected: re-check it against the
        // list as it is now and save the rest.
        const again = await planImport(db, chunk);
        alreadyListed.push(...again.alreadyListed);
        chunk = again.toInsert;
      }
      // Other 23505 = a badge code was taken meanwhile; the whole chunk was rejected, so pick again.
    }
    if (!done) return { inserted: ids.length, ids, alreadyListed, error: `Saving stopped after ${ids.length} delegates: badge numbers kept clashing. Try again.` };
  }
  return { inserted: ids.length, ids, alreadyListed, error: null };
}

/** Removes sample delegates nobody has checked in. Their meetings and leads go with them (FK cascade). */
export async function removeUncheckedSamples(db: SupabaseClient): Promise<number> {
  const { count, error } = await db
    .from("tp_delegates")
    .delete({ count: "exact" })
    .eq("is_sample", true)
    .is("checked_in_at", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export type TpDeskDelegate = {
  id: string;
  token: string;
  badge_code: string;
  full_name: string;
  chapter: string;
  zone: string;
  business_name: string | null;
  industry: string;
  role_title: string | null;
  partner_meetings_opt_in: boolean;
  checked_in_at: string | null;
  is_sample: boolean;
};

/** Every delegate, paged past the 1000-row cap. */
export async function listAllDelegates(db: SupabaseClient): Promise<TpDeskDelegate[]> {
  return pageAll<TpDeskDelegate>((a, b) =>
    db
      .from("tp_delegates")
      .select("id, token, badge_code, full_name, chapter, zone, business_name, industry, role_title, partner_meetings_opt_in, checked_in_at, is_sample")
      .order("full_name")
      .order("id")
      .range(a, b)
  );
}
