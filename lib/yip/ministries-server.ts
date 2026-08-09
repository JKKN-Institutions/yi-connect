import "server-only";

import { createServiceClient } from "@/lib/yip/supabase/server";
import { isMissingMinistryArraysError } from "@/lib/yip/ministries";

// Server-side fetch helpers for the multi-ministry model (see
// lib/yip/ministries.ts for the data-model + degradation contract).
//
// These read a participant's ministry KEY/LABEL set with GRACEFUL DEGRADATION:
// the array columns (`ministries` / `cabinet_portfolios`) may not exist yet
// (code deploys before the user applies the migration), in which case the
// select fails with 42703 and we retry with the legacy single columns only.

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

export type ParticipantMinistryState = {
  /** ALL ministry KEYS held, primary first. Empty = holds no ministry. */
  keys: string[];
  /** Ministry LABELS, index-aligned with `keys` (element may be null). */
  labels: (string | null)[];
  /** Legacy single columns (the PRIMARY ministry). */
  ministry: string | null;
  cabinet_portfolio: string | null;
  /** True when the array columns don't exist yet (migration not applied). */
  degraded: boolean;
};

/**
 * Read a participant's full ministry state (keys + labels, primary first),
 * surviving the array columns not existing yet. Returns null when the
 * participant row itself can't be found.
 */
export async function fetchParticipantMinistryState(
  supabase: ServiceClient,
  participantId: string,
  eventId?: string
): Promise<ParticipantMinistryState | null> {
  const select = (cols: string) => {
    let q = (supabase.from("participants") as ReturnType<typeof supabase.from>)
      .select(cols)
      .eq("id", participantId);
    if (eventId) q = q.eq("event_id", eventId);
    return q.maybeSingle();
  };

  let degraded = false;
  let res = await select(
    "ministry, cabinet_portfolio, ministries, cabinet_portfolios"
  );
  if (res.error && isMissingMinistryArraysError(res.error)) {
    degraded = true;
    res = await select("ministry, cabinet_portfolio");
  }
  if (res.error || !res.data) return null;

  const row = res.data as unknown as {
    ministry: string | null;
    cabinet_portfolio: string | null;
    ministries?: (string | null)[] | null;
    cabinet_portfolios?: (string | null)[] | null;
  };

  const rawKeys = Array.isArray(row.ministries) ? row.ministries : null;
  const rawLabels = Array.isArray(row.cabinet_portfolios)
    ? row.cabinet_portfolios
    : null;

  let keys: string[] = [];
  let labels: (string | null)[] = [];
  if (rawKeys && rawKeys.length > 0) {
    // Zip keys+labels by index, dropping blank keys WITH their label slot so
    // the two arrays stay aligned.
    rawKeys.forEach((k, i) => {
      if (typeof k === "string" && k.trim().length > 0) {
        keys.push(k);
        labels.push(rawLabels?.[i] ?? null);
      }
    });
  }
  if (keys.length === 0 && row.ministry) {
    keys = [row.ministry];
    labels = [row.cabinet_portfolio ?? null];
  }

  return {
    keys,
    labels,
    ministry: row.ministry,
    cabinet_portfolio: row.cabinet_portfolio,
    degraded,
  };
}

/**
 * Just the ministry KEY set (primary first) — what Question-Hour / motion
 * routing needs. Empty array = participant holds no ministry (fail closed).
 */
export async function fetchParticipantMinistryKeys(
  supabase: ServiceClient,
  participantId: string,
  eventId?: string
): Promise<string[]> {
  const state = await fetchParticipantMinistryState(
    supabase,
    participantId,
    eventId
  );
  return state?.keys ?? [];
}
