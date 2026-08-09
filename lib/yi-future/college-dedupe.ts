// ═══════════════════════════════════════════════════════════════════════
// Grouping helpers for the chapter "Duplicates" view on the colleges page.
//
// Lives in lib/ rather than beside the server action because a "use server"
// file may export ONLY async functions — a type or a helper in one breaks
// the Vercel build at module eval.
//
// Why this exists: the colleges page already suggests a merge target for
// PENDING colleges via Levenshtein (see suggestMerge in the page). That only
// ever looks at unapproved rows, so a name that was approved under four
// different spellings never surfaces. Erode carries 20 spellings of one
// college holding 84 delegates for exactly that reason.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Collapse a college name to a comparison key: lowercase, then drop every
 * character that is not a letter or a digit.
 *
 * Deliberately STRICT — it groups only names that are identical once
 * punctuation, spacing and case are removed ("K.S.Rangasamy College of
 * Technology" == "K S Rangasamy college of technology"). It does NOT group
 * names that differ by even one letter, so "Rangasamy" and "Rangaswamy" stay
 * apart. That is the safe direction to be wrong in: a missed duplicate costs
 * a second review pass, a wrong merge moves real students under a college
 * they never attended.
 */
export function collegeKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export type DedupeCandidate = {
  id: string;
  name: string;
  city: string | null;
  is_approved: boolean;
  delegate_count: number;
};

/** Outcome of merging one cluster. Lives here because a "use server" file
 *  may export only async functions. */
export type MergeClusterResult =
  | {
      ok: true;
      /** Variants folded into the target. */
      merged: number;
      /** Delegates re-linked onto the target. */
      delegatesMoved: number;
      /** Variants that refused to merge, addressed by name. */
      failures: string[];
    }
  | { ok: false; error: string };

export type DuplicateGroup = {
  key: string;
  /** The row every other variant should merge into. */
  target: DedupeCandidate;
  /** The variants that would be merged away, most-populated first. */
  sources: DedupeCandidate[];
  /** Delegates that would end up on the target if this group is merged. */
  totalDelegates: number;
};

/**
 * Cluster colleges that share a normalised name.
 *
 * Target selection, in order: an approved row beats an unapproved one (the
 * merge action refuses an unapproved target), then the most delegates, then
 * the longest name — the longest spelling is usually the fully punctuated
 * one a human would recognise ("K.S.Rangasamy College of Technology" over
 * "KSR"). Ties break on id so the choice is stable across renders.
 */
export function groupDuplicateColleges(
  rows: DedupeCandidate[]
): DuplicateGroup[] {
  const byKey = new Map<string, DedupeCandidate[]>();
  for (const r of rows) {
    const k = collegeKey(r.name);
    if (!k) continue; // a name of pure punctuation groups with nothing
    const bucket = byKey.get(k);
    if (bucket) bucket.push(r);
    else byKey.set(k, [r]);
  }

  const groups: DuplicateGroup[] = [];
  for (const [key, bucket] of byKey) {
    if (bucket.length < 2) continue;

    const ranked = [...bucket].sort((a, b) => {
      if (a.is_approved !== b.is_approved) return a.is_approved ? -1 : 1;
      if (a.delegate_count !== b.delegate_count) {
        return b.delegate_count - a.delegate_count;
      }
      if (a.name.length !== b.name.length) return b.name.length - a.name.length;
      return a.id.localeCompare(b.id);
    });

    const [target, ...sources] = ranked;
    groups.push({
      key,
      target,
      sources,
      totalDelegates: bucket.reduce((n, c) => n + c.delegate_count, 0),
    });
  }

  // Biggest problem first: most students affected, then most spellings.
  return groups.sort(
    (a, b) =>
      b.totalDelegates - a.totalDelegates ||
      b.sources.length - a.sources.length ||
      a.target.name.localeCompare(b.target.name)
  );
}
