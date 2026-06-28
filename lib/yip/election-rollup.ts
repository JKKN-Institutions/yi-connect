/**
 * Types for the persistent "Results so far" roll-up on the YIP control panel.
 *
 * These live in lib/ (not the "use server" voting.ts) because a "use server"
 * module may export only async functions — exporting interfaces from it breaks
 * the Vercel build. The server action `getElectionResults` (in voting.ts) returns
 * `RollupEntry[]`; the client roll-up component imports these types from here.
 */

export interface RollupOption {
  /** Display label: a candidate name, or AYE / NAY / ABSTAIN for bill votes. */
  label: string;
  count: number;
  /** True for the single unambiguous top candidate (no tie). Candidate votes only. */
  isWinner: boolean;
  kind: "candidate" | "aye" | "nay" | "abstain";
}

export interface RollupEntry {
  sessionId: string;
  voteType: string;
  /** Human title, e.g. "Speaker Election" or "BJP — Party Leader". */
  title: string;
  /** Optional one-line note, e.g. "Passed" for a bill or the Speaker→Deputy rule. */
  subtitle: string | null;
  totalVotes: number;
  /** Options sorted by count desc (candidate votes) or aye/nay/abstain order (bills). */
  options: RollupOption[];
  revealedAt: string | null;
}
