/**
 * YIP Chapter Round Report — Section 5: Committees & Bills (+ Section 8 draft-
 * bill annexures).
 *
 * Self-fetching React Server Component following the reference contract
 * (Overview.tsx):
 *   - default-exported async server component (no "use client" here —
 *     interactivity lives in the "use client" CommitteesBillsFill children).
 *   - signature: ({ eventId, canManage }: { eventId: string; canManage: boolean }).
 *   - fetches its OWN data via getCommitteesBillsData; the page never passes
 *     data in.
 *   - renders the printable report block; when canManage && a field is empty,
 *     renders the inline capture control (print:hidden).
 *   - returns null when the data getter returns null (no-access / missing event)
 *     so it never throws inside the page's Suspense.
 *
 * Layout:
 *   Section 5 — a committee summary table (No. · Committee · Leader · Bill ·
 *   Outcome).
 *   Section 8 — one annexure card per committee with a drafted bill: full bill
 *   text (objective, problem statement, provisions, expected impact,
 *   implementation), the recorded vote, and any supporting documents.
 */
import {
  getCommitteesBillsData,
  type BillOutcome,
  type CommitteeRow,
} from "@/lib/yip/report/sections/committees-bills";
import {
  CommitteeLeaderFill,
  BillOutcomeFill,
} from "./CommitteesBillsFill";

/** Badge styling + label for each outcome. */
function outcomeMeta(outcome: BillOutcome): { label: string; className: string } {
  switch (outcome) {
    case "passed":
      return {
        label: "Passed",
        className: "border-[#138808]/30 bg-[#138808]/10 text-[#138808]",
      };
    case "rejected":
      return {
        label: "Rejected",
        className: "border-red-300 bg-red-50 text-red-700",
      };
    default:
      return {
        label: "Not Presented",
        className: "border-[#1a1a3e]/15 bg-[#1a1a3e]/5 text-[#1a1a3e]/55",
      };
  }
}

function OutcomeBadge({ outcome }: { outcome: BillOutcome }) {
  const meta = outcomeMeta(outcome);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

/** A labelled bill-text block in a Section 8 annexure. */
function BillField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value || !value.trim()) return null;
  return (
    <div className="break-inside-avoid">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1a1a3e]/40">
        {label}
      </p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-[#1a1a3e]/85">
        {value.trim()}
      </p>
    </div>
  );
}

export default async function CommitteesBillsSection({
  eventId,
  canManage,
}: {
  eventId: string;
  canManage: boolean;
}) {
  const data = await getCommitteesBillsData(eventId);
  if (!data) return null;

  const { committees } = data;

  if (committees.length === 0) {
    return (
      <p className="text-sm text-[#1a1a3e]/40">
        No committees were recorded for this event.
      </p>
    );
  }

  // Section 8 annexures = committees whose bill has any drafted text.
  const annexures = committees.filter(
    (c) =>
      c.bill &&
      (c.bill.title ||
        c.bill.objective ||
        c.bill.problemStatement ||
        c.bill.provisions.length > 0 ||
        c.bill.expectedImpact ||
        c.bill.implementation)
  );

  return (
    <div className="space-y-8">
      {/* ── Section 5: committee summary table ─────────────────────────── */}
      <div className="overflow-hidden rounded-lg border border-[#1a1a3e]/10">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#1a1a3e]/[0.03] text-left text-[11px] font-semibold uppercase tracking-wider text-[#1a1a3e]/50">
              <th className="w-10 px-3 py-2">No.</th>
              <th className="px-3 py-2">Committee</th>
              <th className="px-3 py-2">Leader</th>
              <th className="px-3 py-2">Bill Drafted</th>
              <th className="px-3 py-2">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {committees.map((c: CommitteeRow) => (
              <tr
                key={c.name}
                className="break-inside-avoid border-t border-[#1a1a3e]/8 align-top"
              >
                <td className="px-3 py-2 font-semibold text-[#1a1a3e]">
                  {c.number ?? "—"}
                </td>
                <td className="px-3 py-2 font-medium text-[#1a1a3e]">
                  {c.name}
                </td>
                <td className="px-3 py-2 text-[#1a1a3e]/80">
                  {c.leader ? (
                    <span>{c.leader}</span>
                  ) : (
                    <span className="text-[#1a1a3e]/40">Not recorded</span>
                  )}
                  {canManage && (
                    <div>
                      <CommitteeLeaderFill
                        eventId={eventId}
                        committeeName={c.name}
                        initialValue={c.leaderSource === "meta" ? c.leader ?? "" : ""}
                        hasLeader={Boolean(c.leader)}
                      />
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-[#1a1a3e]/80">
                  {c.bill?.title ? (
                    <span>{c.bill.title}</span>
                  ) : (
                    <span className="text-[#1a1a3e]/40">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <OutcomeBadge outcome={c.outcome} />
                  {c.outcomeOverridden && (
                    <span className="ml-1.5 align-middle text-[10px] text-[#1a1a3e]/40">
                      (set)
                    </span>
                  )}
                  {canManage && (
                    <div>
                      <BillOutcomeFill
                        eventId={eventId}
                        committeeName={c.name}
                        overridden={c.outcomeOverridden}
                      />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Section 8: per-committee draft-bill annexures ──────────────── */}
      <div className="space-y-5">
        <h3 className="font-[family-name:var(--font-heading)] text-base font-semibold text-[#1a1a3e]">
          Annexure — Draft Bills
        </h3>

        {annexures.length === 0 ? (
          <p className="text-sm text-[#1a1a3e]/40">
            No committee bills were drafted for this event.
          </p>
        ) : (
          annexures.map((c) => {
            const bill = c.bill!;
            return (
              <article
                key={c.name}
                className="break-inside-avoid rounded-lg border border-[#1a1a3e]/10 p-4"
              >
                <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-[#1a1a3e]/8 pb-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#FF9933]">
                      Committee {c.number ?? "—"} · {c.name}
                    </p>
                    <h4 className="mt-0.5 text-base font-semibold text-[#1a1a3e]">
                      {bill.title ?? "Untitled Bill"}
                    </h4>
                  </div>
                  <OutcomeBadge outcome={c.outcome} />
                </header>

                <div className="space-y-3">
                  <BillField label="Objective" value={bill.objective} />
                  <BillField
                    label="Problem Statement"
                    value={bill.problemStatement}
                  />

                  {bill.provisions.length > 0 && (
                    <div className="break-inside-avoid">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1a1a3e]/40">
                        Provisions
                      </p>
                      <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-[#1a1a3e]/85">
                        {bill.provisions.map((prov, i) => (
                          <li key={i} className="whitespace-pre-wrap">
                            {prov}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <BillField
                    label="Expected Impact"
                    value={bill.expectedImpact}
                  />
                  <BillField
                    label="Implementation"
                    value={bill.implementation}
                  />

                  {/* Recorded vote, when the bill went to a floor vote. */}
                  {(bill.votesFor != null ||
                    bill.votesAgainst != null ||
                    bill.votesAbstain != null) && (
                    <div className="break-inside-avoid">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1a1a3e]/40">
                        Recorded Vote
                      </p>
                      <p className="mt-0.5 text-sm text-[#1a1a3e]/85">
                        For{" "}
                        <span className="font-semibold text-[#138808]">
                          {bill.votesFor ?? 0}
                        </span>{" "}
                        · Against{" "}
                        <span className="font-semibold text-red-600">
                          {bill.votesAgainst ?? 0}
                        </span>{" "}
                        · Abstain{" "}
                        <span className="font-semibold text-[#1a1a3e]/70">
                          {bill.votesAbstain ?? 0}
                        </span>
                      </p>
                    </div>
                  )}

                  {/* Supporting documents (names + descriptions; the report is a
                      printed artefact, so we list rather than link). */}
                  {c.documents.length > 0 && (
                    <div className="break-inside-avoid">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1a1a3e]/40">
                        Supporting Documents
                      </p>
                      <ul className="mt-1 space-y-1 text-sm text-[#1a1a3e]/85">
                        {c.documents.map((doc, i) => (
                          <li key={i}>
                            <span className="font-medium">{doc.fileName}</span>
                            {doc.description ? (
                              <span className="text-[#1a1a3e]/55">
                                {" "}
                                — {doc.description}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* AI craft feedback on the bill (only when the chair opted the
                      event into AI and a ready note exists). Prose about the
                      bill's craft — never a score, rank, or person. */}
                  {c.billFeedback ? (
                    <div className="break-inside-avoid rounded-lg border border-sky-200/70 bg-sky-50/50 px-3 py-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-700/70">
                        Feedback on the Bill&apos;s Craft
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[#1a1a3e]/85">
                        {c.billFeedback}
                      </p>
                      <p className="mt-1.5 text-[10px] leading-snug text-[#1a1a3e]/40">
                        Constructive AI feedback on the bill&apos;s craft — never
                        a score, rank, or comparison of people.
                      </p>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
