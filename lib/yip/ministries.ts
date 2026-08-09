// Multi-ministry helpers (participants can hold MORE THAN ONE ministry).
//
// Data model (additive, back-compat):
//   • yip.participants.ministry (text)            — PRIMARY ministry KEY (legacy single)
//   • yip.participants.cabinet_portfolio (text)   — PRIMARY ministry LABEL (legacy single)
//   • yip.participants.ministries (text[])        — ALL ministry KEYS held (primary first)
//   • yip.participants.cabinet_portfolios (text[])— ALL ministry LABELS, index-aligned
//     with `ministries` (an element may be NULL for legacy rows that had a key
//     but no portfolio label).
//
// The single columns ALWAYS hold the primary (= first array element); the
// arrays hold the complete set INCLUDING the primary. The migration
// (supabase/migrations/*_yip_participant_multi_ministry.sql) adds a trigger
// that keeps the arrays in sync when legacy single-column writers touch only
// `ministry` / `cabinet_portfolio`.
//
// GRACEFUL DEGRADATION: code deploys BEFORE the migration is applied, so every
// read/write of the array columns must survive them not existing yet. Readers
// use `isMissingMinistryArraysError` to detect that failure and retry without
// the array columns; these helpers then fall back to the single columns.
//
// PURE + CLIENT-SAFE — no DB, no "use server". Server-side fetch helpers live
// in lib/yip/ministries-server.ts.

export type MinistryKeysCarrier = {
  ministry?: string | null;
  ministries?: (string | null)[] | null;
};

export type MinistryLabelsCarrier = {
  cabinet_portfolio?: string | null;
  cabinet_portfolios?: (string | null)[] | null;
};

/**
 * All ministry KEYS a participant holds, primary first. Prefers the
 * `ministries` array when present and non-empty; falls back to the single
 * `ministry` column (pre-migration rows / degraded reads).
 */
export function participantMinistries(p: MinistryKeysCarrier): string[] {
  if (Array.isArray(p.ministries) && p.ministries.length > 0) {
    const keys = p.ministries.filter(
      (k): k is string => typeof k === "string" && k.trim().length > 0
    );
    if (keys.length > 0) return keys;
  }
  return p.ministry ? [p.ministry] : [];
}

/**
 * All ministry LABELS (cabinet portfolios) a participant holds, primary first.
 * Prefers the `cabinet_portfolios` array; falls back to the single
 * `cabinet_portfolio` column. Null/blank elements (legacy rows with a key but
 * no label) are dropped — label-based matching should simply not match them,
 * mirroring the previous single-column behaviour.
 */
export function participantPortfolios(p: MinistryLabelsCarrier): string[] {
  if (Array.isArray(p.cabinet_portfolios) && p.cabinet_portfolios.length > 0) {
    const labels = p.cabinet_portfolios
      .filter((l): l is string => typeof l === "string" && l.trim().length > 0)
      .map((l) => l.trim());
    if (labels.length > 0) return labels;
  }
  const single = (p.cabinet_portfolio ?? "").trim();
  return single ? [single] : [];
}

/**
 * True when a Supabase/PostgREST error means the `ministries` /
 * `cabinet_portfolios` columns don't exist yet (migration not applied).
 *   • SELECT with an unknown column → Postgres 42703 "column … does not exist"
 *   • UPDATE payload with an unknown column → PostgREST PGRST204
 *     "Could not find the '…' column of 'participants' in the schema cache"
 * Callers catch THIS specific failure and retry with single-column behaviour.
 */
export function isMissingMinistryArraysError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code ?? "";
  const message = (err as { message?: string }).message ?? "";
  if (!/ministries|cabinet_portfolios/.test(message)) return false;
  return (
    code === "42703" ||
    code === "PGRST204" ||
    /does not exist|schema cache/i.test(message)
  );
}
