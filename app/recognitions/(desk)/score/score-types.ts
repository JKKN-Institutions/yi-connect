/** Inputs for the scoring desk's server actions (kept out of the "use server" file). */

export type SaveScoreInput = {
  evaluatorId: string;
  nominationId: string;
  /** Only the parameters the evaluator has marked; drafts may be partial. */
  params: Record<string, number | null | undefined>;
  /** Always five boxes. */
  reasons: string[];
  /** NMT only; ignored for a Regional Mentor. */
  comments: string;
  submit: boolean;
};

export type FlagInput = {
  evaluatorId: string;
  nominationId: string;
  on: boolean;
};
