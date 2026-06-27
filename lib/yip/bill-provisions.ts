/**
 * Bill provisions — the ONE place that understands the (historically messy)
 * shape of `yip.bills.provisions` and turns it into a stable clause list.
 *
 * Migration 20260627205000 normalised the column to `{ id, text }[]`, but rows
 * can still be encountered mid-transition or from older writers in three shapes:
 *   • `[{ id, text }, …]`        — the target shape (pass through)
 *   • `["clause", …]`            — a flat string array (legacy drafting UI)
 *   • `{ note?, clauses: [...] }` — the old mock-seeder wrapper
 *   • `[]` / null / anything else — no clauses
 *
 * Pure + isomorphic (no "server-only") so client renderers AND server actions
 * share it. It does NOT mint UUIDs (clients lack a guaranteed crypto): a clause
 * missing an id gets a render-stable `c<index>` key. Real ids are minted in the
 * server action when a clause is created (see committee-room.ts).
 */

export type Clause = { id: string; text: string };

/** Unwrap whatever provisions shape into the raw element array. */
function rawElements(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const clauses = (raw as Record<string, unknown>).clauses;
    if (Array.isArray(clauses)) return clauses;
  }
  return [];
}

/**
 * Normalise any provisions value to a clean `Clause[]`. Empty-text clauses are
 * dropped. Order is preserved.
 */
export function normalizeProvisions(raw: unknown): Clause[] {
  return rawElements(raw)
    .map((el, i): Clause | null => {
      if (typeof el === "string") {
        const text = el.trim();
        return text ? { id: `c${i}`, text } : null;
      }
      if (el && typeof el === "object") {
        const o = el as Record<string, unknown>;
        const text = typeof o.text === "string" ? o.text.trim() : "";
        if (!text) return null;
        const id =
          typeof o.id === "string" && o.id.length > 0 ? o.id : `c${i}`;
        return { id, text };
      }
      return null;
    })
    .filter((c): c is Clause => c !== null);
}

/** Just the clause texts — for read-only renderers that ignore ids. */
export function clauseTexts(raw: unknown): string[] {
  return normalizeProvisions(raw).map((c) => c.text);
}

/** True when the bill has at least one non-empty clause. */
export function hasClauses(raw: unknown): boolean {
  return normalizeProvisions(raw).length > 0;
}
