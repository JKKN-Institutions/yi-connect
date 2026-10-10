import Link from "next/link";
import type { Metadata } from "next";
import { requireRxNationalLeadership, requireRxOversight } from "@/lib/recognitions/auth";
import { effectiveText, getAwardState, getPeople, listAudit, listCitationEdits } from "@/lib/recognitions/data";
import { CATEGORIES, CATEGORY_LABEL, LAYER2_PARAMS, LAYER3_PARAMS, LAYER_LABEL, PARAM_KEYS } from "@/lib/recognitions/constants";
import { paramsTotal } from "@/lib/recognitions/scoring";
import { Ribbon } from "@/app/recognitions/_ui/ribbon";
import { IconArrowLeft } from "@/app/recognitions/_ui/icons";
import { NoAccess, Notice, PageHead, PhaseSeal, Seal, formatWhen } from "@/app/recognitions/_ui/primitives";
import { CombinedMatrix, Dossier } from "@/app/recognitions/_parts/combined-matrix";
import { PredictionsBoard } from "@/app/recognitions/_parts/predictions-board";
import { RankingTable, VersionHistory } from "@/app/recognitions/_parts/ranking-view";
import { loadStage2 } from "@/app/recognitions/_parts/load";
import { buildRankingView, chapterName } from "@/app/recognitions/_parts/shared";
import { DecisionPanel } from "./decision-panel";

export const metadata: Metadata = { title: "Award review" };

function detailText(detail: Record<string, unknown>): string {
  const parts = Object.entries(detail ?? {})
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  const s = parts.join(" · ");
  return s.length > 240 ? `${s.slice(0, 237)}…` : s;
}

export default async function AwardReview({ params }: { params: Promise<{ awardId: string }> }) {
  const { awardId } = await params;
  const gate = await requireRxOversight();
  if (!gate.ok) return <NoAccess reason={gate.error} />;

  const state = await getAwardState(awardId);
  if (!state) return <NoAccess reason="This award does not exist or was removed." contact={false} />;
  const { award, cycle, phase } = state;

  // Blind scoring beats oversight: someone who is BOTH leadership/admin and an
  // evaluator on this award must not see colleagues' marks while Stage 1 runs.
  const scoringStillBlind = phase === "setup" || phase === "nominations" || phase === "stage1";
  if (scoringStillBlind && gate.viewer.duties.some((d) => d.award_id === award.id)) {
    return (
      <NoAccess
        reason="You are also an evaluator on this award. To keep scoring blind, its review opens once every mark is in and Stage 2 starts."
        contact={false}
      />
    );
  }

  const canDecide = phase === "governance" && (await requireRxNationalLeadership()).ok;
  const [data, auditRows, edits] = await Promise.all([
    loadStage2(state, { withNames: true }),
    listAudit({ awardId }),
    listCitationEdits(awardId),
  ]);
  const actors = await getPeople(auditRows.map((a) => a.actor_person_id).filter((x): x is string => !!x));
  const evaluatorLayer = new Map(state.duties.map((d) => [d.id, d.layer]));

  const finalVersion = state.latestSubmittedVersion;
  const finalView = finalVersion
    ? buildRankingView(finalVersion, state.nominations, data.chapters, (category, rank, fallback) =>
        effectiveText(edits, finalVersion.id, "citation", category, rank, fallback)
      )
    : [];

  return (
    <div className="rx-stack-lg">
      <div className="rx-stack">
        <Link href="/recognitions/review" className="rx-link rx-small rx-row" style={{ gap: 6 }}>
          <IconArrowLeft size={14} /> All awards
        </Link>
        <PageHead eyebrow={`${cycle.name} · Review`} title={award.title}>
          <div className="rx-row">
            <Ribbon vertical={award.vertical} size="lg" />
            <PhaseSeal phase={phase} />
          </div>
        </PageHead>

        {phase === "governance" && finalVersion ? (
          canDecide ? (
            <DecisionPanel awardId={award.id} version={finalVersion.version} />
          ) : (
            <Notice>
              Version {finalVersion.version} is waiting for a decision. Only National Leadership can approve it or send
              it back; you can read both summaries below.
            </Notice>
          )
        ) : null}
        {phase === "reevaluation" ? (
          <Notice tone="alert">Sent back for re-evaluation. The NMT leader is revising the moderation.</Notice>
        ) : null}
        {phase === "finalized" ? (
          <Notice tone="ok">Approved on version {finalVersion?.version}. This award is final.</Notice>
        ) : null}
      </div>

      {/* ------------------------------------------------ Stage 1 summary */}
      <section className="rx-stack" aria-labelledby="rx-s1">
        <h2 className="rx-h1" id="rx-s1" style={{ fontSize: "1.7rem" }}>Stage 1 summary</h2>
        <p className="rx-small rx-mute">
          Every Regional Mentor and NMT score with the evaluator&apos;s name. RM parameters:{" "}
          {LAYER2_PARAMS.map((p, i) => `P${i + 1} ${p.label}`).join(", ")}. NMT parameters:{" "}
          {LAYER3_PARAMS.map((p, i) => `P${i + 1} ${p.label}`).join(", ")}.
        </p>
        {state.checkedNominations.length === 0 ? (
          <p className="rx-mute">No nomination for this award has passed both checks yet.</p>
        ) : (
          CATEGORIES.map((category) => {
            const noms = state.checkedNominations
              .filter((n) => n.category === category)
              .sort((a, b) => chapterName(data.chapters, a.chapter_id).localeCompare(chapterName(data.chapters, b.chapter_id)));
            if (noms.length === 0) return null;
            return (
              <div key={category} className="rx-stack">
                <h3 className="rx-h3">{CATEGORY_LABEL[category]}</h3>
                <div>
                  {noms.map((n) => {
                    const scores = data.scores
                      .filter((s) => s.nomination_id === n.id)
                      .sort((a, b) => (a.layer === b.layer ? 0 : a.layer === "rm" ? -1 : 1));
                    const submittedCount = scores.filter((s) => s.status === "submitted").length;
                    return (
                      <details key={n.id} className="rx-p-fold">
                        <summary>
                          <span className="rx-h3">{chapterName(data.chapters, n.chapter_id)}</span>
                          <span className="rx-small rx-mute">
                            {n.region} · {submittedCount} submitted score{submittedCount === 1 ? "" : "s"}
                          </span>
                        </summary>
                        <div className="rx-p-fold-body">
                          {scores.length === 0 ? (
                            <p className="rx-small rx-mute">No evaluator has scored this chapter yet.</p>
                          ) : (
                            <div className="rx-ledger-wrap">
                              <table className="rx-ledger">
                                <thead>
                                  <tr>
                                    <th>Evaluator</th>
                                    <th>Layer</th>
                                    {PARAM_KEYS.map((k, i) => (
                                      <th key={k} className="rx-num">P{i + 1}</th>
                                    ))}
                                    <th className="rx-num">Total</th>
                                    <th>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {scores.map((s) => (
                                    <tr key={s.id}>
                                      <td>{data.evaluatorNames[s.evaluator_id] ?? "Unknown evaluator"}</td>
                                      <td>{s.layer === "rm" ? "RM" : "NMT"}</td>
                                      {PARAM_KEYS.map((k) => (
                                        <td key={k} className="rx-num">{s.params[k] ?? "—"}</td>
                                      ))}
                                      <td className="rx-num">{paramsTotal(s.params)}</td>
                                      <td>
                                        <Seal tone={s.status === "submitted" ? "laurel" : "gilt"}>
                                          {s.status === "submitted" ? "Submitted" : "Draft"}
                                        </Seal>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {scores.map((s) => {
                            const reasons = (s.reasons ?? []).filter((r) => (r ?? "").trim() !== "");
                            return (
                              <div key={`r-${s.id}`} className="rx-stack" style={{ gap: 6 }}>
                                <div className="rx-row" style={{ gap: 8 }}>
                                  <strong>{data.evaluatorNames[s.evaluator_id] ?? "Unknown evaluator"}</strong>
                                  <span className="rx-small rx-mute">
                                    {LAYER_LABEL[evaluatorLayer.get(s.evaluator_id) ?? s.layer]}
                                    {s.submitted_at ? ` · submitted ${formatWhen(s.submitted_at)}` : " · not submitted"}
                                  </span>
                                </div>
                                {reasons.length > 0 ? (
                                  <ol className="rx-p-list rx-small">
                                    {reasons.map((r, i) => (
                                      <li key={i} className="rx-p-text">{r}</li>
                                    ))}
                                  </ol>
                                ) : (
                                  <p className="rx-small rx-mute">No reasons written.</p>
                                )}
                                {s.additional_comments?.trim() ? (
                                  <p className="rx-p-quote rx-small">{s.additional_comments}</p>
                                ) : null}
                              </div>
                            );
                          })}
                          <details className="rx-p-fold">
                            <summary>
                              <span className="rx-small">The chapter&apos;s nomination</span>
                            </summary>
                            <div className="rx-p-fold-body">
                              <Dossier
                                dossier={{
                                  reasons: (n.reasons ?? []).filter((r) => (r ?? "").trim() !== ""),
                                  flagship: n.flagship_event ?? "",
                                  hostedEvent: n.hosted_event,
                                  hostedName: n.hosted_event_name,
                                  hostedType: n.hosted_event_type,
                                  announcement: n.announcement_draft ?? "",
                                }}
                              />
                            </div>
                          </details>
                        </div>
                      </details>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

        <div className="rx-stack">
          <h3 className="rx-h3">Audit trail</h3>
          {auditRows.length === 0 ? (
            <p className="rx-small rx-mute">Nothing has been recorded for this award yet.</p>
          ) : (
            <div className="rx-ledger-wrap">
              <table className="rx-ledger">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Who</th>
                    <th>What</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {auditRows.map((a) => (
                    <tr key={a.id}>
                      <td className="rx-num" style={{ whiteSpace: "nowrap" }}>{formatWhen(a.at)}</td>
                      <td>{a.actor_person_id ? actors.get(a.actor_person_id)?.full_name ?? "Unknown person" : "System"}</td>
                      <td>{a.action.replace(/_/g, " ")}</td>
                      <td className="rx-small rx-mute" style={{ minWidth: 220 }}>{detailText(a.detail)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {auditRows.length >= 200 ? (
            <p className="rx-small rx-mute">Showing the latest 200 entries.</p>
          ) : null}
        </div>
      </section>

      <hr className="rx-rule" />

      {/* ------------------------------------------------ Stage 2 summary */}
      <section className="rx-stack-lg" aria-labelledby="rx-s2">
        <h2 className="rx-h1" id="rx-s2" style={{ fontSize: "1.7rem" }}>Stage 2 summary</h2>
        <CombinedMatrix view={data.matrix} />

        <section className="rx-stack" aria-labelledby="rx-s2-final">
          <h2 className="rx-h2" id="rx-s2-final">Final rankings, top 3 rationales and citations</h2>
          {finalVersion ? (
            <>
              <p className="rx-small rx-mute">
                Version {finalVersion.version}, submitted {formatWhen(finalVersion.submitted_at)}. Citations show the
                super admin&apos;s polished text where there is one.
              </p>
              <RankingTable view={finalView} />
            </>
          ) : (
            <p className="rx-mute">The NMT leader hasn&apos;t submitted a moderation yet.</p>
          )}
        </section>

        <PredictionsBoard view={data.predictions} />
        <VersionHistory history={data.history} />
      </section>
    </div>
  );
}
