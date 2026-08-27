/**
 * Per-student option order for a multiple-choice paper.
 *
 * THE BUG THIS CLOSES. `yiq.papers.shuffle_options` has been TRUE on every
 * live paper since the platform shipped, but app/yiq/actions/attempt.ts
 * deliberately did not implement it — there is a comment saying so. A truthy
 * config flag that does nothing reads to everyone downstream as "this is
 * handled", and it was not: every student saw every question with its options
 * in the order they were authored.
 *
 * WHY THAT MATTERS MORE THAN IT SOUNDS. Question banks acquire a lopsided
 * answer key without anyone intending it — the reasoning bank added on
 * 2026-08-27 came out at 85 'b' and 8 'd' before it was rebalanced, which
 * would have let a student scoring nothing but B collect 42.5%. Rebalancing a
 * bank by hand fixes one bank, once. Shuffling per student fixes every bank
 * that will ever be loaded, permanently, and it also means two students
 * sitting side by side cannot read each other's answers by position.
 *
 * WHY NO PERMUTATION IS STORED. The order is DERIVED from (attemptId,
 * questionId), so it is:
 *   - stable across a page reload, a navigation, and a resumed attempt —
 *     which the restart feature depends on, since a student who comes back
 *     after a dead phone must see the paper exactly as they left it;
 *   - different for every student, because attemptId differs;
 *   - free of any schema change, any migration, and any write on the hot
 *     answering path.
 *
 * WHY SHUFFLING IS SAFE HERE, THOUGH THE OLD COMMENT SAID OTHERWISE. The
 * old note reasoned that re-ordering options would make a saved answer point
 * at different text. That would be true if the client submitted a POSITION.
 * It does not: quiz-client.tsx submits `o.key`, the CANONICAL letter, which
 * travels with its own text through any permutation. `attempt_answers
 * .selected_option` therefore keeps meaning exactly what it always meant, and
 * scoring is untouched.
 *
 * The DISPLAY label is a separate matter — a shuffled list must be labelled
 * by position (A, B, C, D down the page), never by the canonical key, or the
 * student reads "c, a, d, b" and thinks the page is broken.
 */

import { OPTION_KEYS, type OptionKey } from "./paper";

/**
 * FNV-1a, 32-bit. Chosen because it is tiny, has no dependencies, and is
 * exactly reproducible — this must return the same number on every server,
 * on every deploy, forever, or a student's options move under them.
 *
 * This is NOT a security hash and must never be used as one.
 */
function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // h *= 16777619, kept in 32-bit range without overflowing a double.
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/**
 * The order the four options should be shown in for THIS student on THIS
 * question. Always all four keys, exactly once each.
 *
 * A missing or empty attemptId/questionId returns the authored order rather
 * than throwing — a paper that renders in the wrong order is a nuisance, a
 * paper that fails to render is a student who cannot sit the round.
 */
export function optionOrderFor(
  attemptId: string | null | undefined,
  questionId: string | null | undefined
): OptionKey[] {
  const keys = [...OPTION_KEYS] as OptionKey[];
  if (!attemptId || !questionId) return keys;

  // Fisher-Yates, driven by a counter-stepped hash so each swap draws a
  // fresh number rather than reusing one seed's low bits.
  let h = fnv1a(`${attemptId}:${questionId}`);
  for (let i = keys.length - 1; i > 0; i--) {
    h = fnv1a(`${h}`);
    const j = h % (i + 1);
    const t = keys[i];
    keys[i] = keys[j];
    keys[j] = t;
  }
  return keys;
}

/**
 * Reorder a question's options for one student, preserving each option's
 * CANONICAL key. Returns the authored order untouched when `shuffle` is off.
 *
 * Anything not in the computed order (a malformed row missing an option) is
 * appended rather than dropped — losing an option silently would change what
 * the question asks.
 */
export function applyOptionOrder<T extends { key: OptionKey }>(
  options: T[],
  attemptId: string | null | undefined,
  questionId: string | null | undefined,
  shuffle: boolean
): T[] {
  if (!shuffle) return options;
  const order = optionOrderFor(attemptId, questionId);
  const byKey = new Map(options.map((o) => [o.key, o]));
  const out: T[] = [];
  for (const k of order) {
    const found = byKey.get(k);
    if (found) {
      out.push(found);
      byKey.delete(k);
    }
  }
  for (const leftover of byKey.values()) out.push(leftover);
  return out;
}

/** The label shown beside an option at display position `index` (0-based). */
export function displayLabelFor(index: number): string {
  return OPTION_KEYS[index] ?? String(index + 1);
}
