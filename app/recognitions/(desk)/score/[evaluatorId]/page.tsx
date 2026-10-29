import Link from "next/link";
import { requireRxDuty } from "@/lib/recognitions/auth";
import {
  chapterMap,
  getAwardState,
  listHealthCardFiles,
  listScoresForDuty,
  nominationsForDuty,
} from "@/lib/recognitions/data";
import { CATEGORIES, CATEGORY_LABEL, CHECK_STEP_ENABLED, PARAM_KEYS, type ParamKey } from "@/lib/recognitions/constants";
import { Ribbon } from "../../../_ui/ribbon";
import { IconArrowLeft, IconArrowRight, IconDownload, IconEyeOff, IconLock } from "../../../_ui/icons";
import { Deadline, NoAccess, Notice, PageHead, Seal, formatWhen } from "../../../_ui/primitives";
import { dutyLayerLabel, dutyScoringWindow, scoringDeadlineFor, scoringWindow } from "../score-rules";
import { ADDED_BY_LABEL, isAddedForChapter, isNlAdded } from "@/lib/recognitions/check-rules";
import { mentorRescoreOpen, scoreSight } from "@/lib/recognitions/sight";
import { ScoreSheet } from "./sheet";
import { FlagToggle } from "./flags";
import { HealthCardPanel } from "./health-card-panel";
import { loadAwardHealthCard } from "@/lib/recognitions/health-card";
import { CheckList } from "../../check/check-list";
import { loadCheckItems } from "../../check/load";
import "../score.css";

export const metadata = { title: "Scoring sheet" };

/** True for a nomination filed on the older form (before recognitions_04): reasons etc., no "why". */
function legacyNomination(n: { reasons: string[]; flagship_event: string; hosted_event: boolean; announcement_draft: string }): boolean {
  return (
    (n.reasons ?? []).some((r) => (r ?? "").trim() !== "") ||
    (n.flagship_event ?? "").trim() !== "" ||
    n.hosted_event ||
    (n.announcement_draft ?? "").trim() !== ""
  );
}

export default async function ScoringSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ evaluatorId: string }>;
  searchParams: Promise<{ n?: string | string[] }>;
}) {
  const { evaluatorId } = await params;
  const sp = await searchParams;
  const wanted = Array.isArray(sp.n) ? sp.n[0] : sp.n;

  const gate = await requireRxDuty(evaluatorId);
  if (!gate.ok) return <NoAccess reason={gate.error} />;
  const duty = gate.value;
  const personId = gate.viewer.personId;

  const state = await getAwardState(duty.award_id);
  if (!state) {
    return <NoAccess reason="This recognition no longer exists or is no longer active." />;
  }
  const { award, cycle } = state;
  const win = scoringWindow(state.phase, cycle);
  // recognitions_05: the NMT leader's send-back reopens a Mentor's sheet; blind until you submit.
  const rescore = mentorRescoreOpen(state) && duty.layer === "rm";
  const sight = scoreSight(state, gate.viewer.duties);
  const latestSendBack = state.sendBacks[0] ?? null;

  // RM only: the nominations from this region still waiting for a check, with
  // the same Pass / Send back controls as the Check desk. Only nominations
  // both checkers passed reach the scoring sheet below.
  const awaiting =
    // The check step is not used in 2026 (CHECK_STEP_ENABLED): nothing waits for a check.
    CHECK_STEP_ENABLED && duty.layer === "rm"
      ? (await loadCheckItems(gate.viewer, cycle, { awardId: award.id })).filter(
          (i) => i.status === "submitted" && i.region === duty.region
        )
      : [];
  const checkPanel =
    awaiting.length > 0 ? (
      <section className="rx-stack" style={{ marginBottom: 24 }}>
        <Notice>
          {awaiting.length} nomination{awaiting.length === 1 ? " is" : "s are"} from your region still waiting for a check.
          A chapter reaches your sheet only after the Regional Chair and a Regional Mentor both pass it.{" "}
          <Link href="/recognitions/check" className="rx-link">Open the Check desk</Link>
        </Notice>
        <CheckList items={awaiting} cycle={cycle} />
      </section>
    ) : null;

  const head = (
    <PageHead eyebrow="Stage 1 · blind scoring" title={award.title}>
      <div className="rx-row" style={{ gap: 10 }}>
        <Ribbon vertical={award.vertical} kind={award.kind} size="lg" />
        <Seal tone={duty.layer === "rm" ? "laurel" : "gilt"}>{dutyLayerLabel(duty)}</Seal>
        <Link href="/recognitions/score" className="rx-link rx-small">All my sheets</Link>
      </div>
      <Deadline label="Stage 1 closes" iso={cycle.stage1_deadline} />
      {sight.sees ? (
        <Notice tone="ok">
          {sight.why === "submitted"
            ? "You have submitted every chapter on your sheet. "
            : "Round 1 is in. "}
          <Link href={`/recognitions/moderate/${award.id}`} className="rx-link" data-testid="see-all-marks">
            See every evaluator&apos;s marks (read-only)
          </Link>
        </Notice>
      ) : (
        <div className="rx-notice">
          <div className="rx-row" style={{ gap: 8, flexWrap: "nowrap", alignItems: "flex-start" }}>
            <IconEyeOff size={18} />
            <span>
              Your marks are private. Other evaluators can&apos;t see them, and you see theirs only after you submit every
              chapter on your sheet.
            </span>
          </div>
        </div>
      )}
      {rescore && latestSendBack ? (
        <Notice tone="alert">
          <strong>The NMT leader sent this recognition back to the Regional Mentors:</strong>{" "}
          <span className="rx-p-text">{latestSendBack.remark}</span>
          <br />
          <span className="rx-small">
            Your earlier marks are kept in the history and loaded below as a draft. Review and resubmit by{" "}
            {formatWhen(cycle.stage2_deadline)}.
          </span>
        </Notice>
      ) : null}
      {state.phase === "nominations" && win.state === "open" ? (
        <Notice tone="alert">
          Test scoring: marks made before nominations close are for testing and will be wiped before real scoring opens
          on {formatWhen(cycle.nomination_deadline)}.
        </Notice>
      ) : null}
    </PageHead>
  );

  if (win.state === "notYet") {
    return (
      <div>
        {head}
        {checkPanel}
        <Notice>
          {cycle.nomination_deadline
            ? `Scoring opens when nominations close on ${formatWhen(cycle.nomination_deadline)}.`
            : "Scoring opens once the nomination deadline has been set and has passed."}
        </Notice>
      </div>
    );
  }

  // Only the chapters this duty may see (region + conflict rule), alphabetical.
  const chapters = await chapterMap();
  const nameOf = (id: string) => chapters.get(id)?.name ?? "Unnamed chapter";
  const visible = nominationsForDuty(state, duty).sort((a, b) =>
    nameOf(a.chapter_id).localeCompare(nameOf(b.chapter_id))
  );

  if (visible.length === 0) {
    return (
      <div>
        {head}
        {checkPanel}
        <div className="rx-plate rx-stack">
          <h2 className="rx-h2">No chapters on your sheet</h2>
          <p className="rx-mute">
            {duty.layer === "rm"
              ? `No chapter in region ${duty.region ?? ""} has a nomination for this recognition that you can score.`
              : "No chapter has a nomination for this recognition that you can score."}
          </p>
        </div>
      </div>
    );
  }

  // BLIND: this duty's own scores only.
  const mine = new Map((await listScoresForDuty(duty.id)).map((s) => [s.nomination_id, s]));
  const firstOpen = visible.find((n) => mine.get(n.id)?.status !== "submitted");
  // An unknown or hidden ?n= falls back silently; it never reveals another chapter.
  const current = visible.find((n) => n.id === wanted) ?? firstOpen ?? visible[0];
  // Pioneers / Trailblazers / Sparks as tabs (Piyush, 28 Oct 2026): the strip
  // and Previous / Next stay inside the current chapter's category.
  const inCat = visible.filter((n) => n.category === current.category);
  const index = inCat.findIndex((n) => n.id === current.id);
  const prev = index > 0 ? inCat[index - 1] : null;
  const next = index < inCat.length - 1 ? inCat[index + 1] : null;
  const tabs = CATEGORIES.map((c) => {
    const mineInCat = visible.filter((n) => n.category === c);
    const target = mineInCat.find((n) => mine.get(n.id)?.status !== "submitted") ?? mineInCat[0] ?? null;
    return { category: c, count: mineInCat.length, target };
  });
  const score = mine.get(current.id) ?? null;
  const submitted = score?.status === "submitted";
  // Per chapter: one National Leadership added is scored during re-evaluation (recognitions_03).
  const curWin = dutyScoringWindow(state.phase, cycle, current, duty, rescore);
  const open = curWin.state === "open";
  const added = isNlAdded(current);
  // Any chapter someone else put forward (National Leadership, a Mentor or the NMT): a reason, not a form.
  const addedFor = isAddedForChapter(current);
  const addedBy = current.origin !== "chapter" && current.origin ? ADDED_BY_LABEL[current.origin] : null;
  const readOnly = !open || submitted;
  const files = await listHealthCardFiles(duty.award_id);
  // Objective data, not another evaluator's mark: only the CURRENT chapter's
  // Health Card is passed to the page, never the whole map.
  const hc = await loadAwardHealthCard(award);
  const hcCard = hc.byChapter.get(current.chapter_id) ?? null;
  const href = (id: string) => `/recognitions/score/${duty.id}?n=${id}`;
  const doneCount = inCat.filter((n) => mine.get(n.id)?.status === "submitted").length;

  const initialParams: Partial<Record<ParamKey, number>> = {};
  for (const k of PARAM_KEYS) {
    const v = score?.params?.[k];
    if (typeof v === "number") initialParams[k] = v;
  }

  return (
    <div>
      {head}
      {checkPanel}

      <div className="rx-stack-lg">
        {/* Deck strip: jump between the chapters on this sheet. */}
        <nav className="rx-cat-tabs" aria-label="Chapter categories">
          {tabs.map((t) =>
            t.target ? (
              <Link
                key={t.category}
                href={href(t.target.id)}
                className="rx-cat-tab"
                aria-current={t.category === current.category ? "page" : undefined}
              >
                {CATEGORY_LABEL[t.category]}
                <span className="rx-cat-tab-n rx-num">{t.count}</span>
              </Link>
            ) : (
              <span key={t.category} className="rx-cat-tab" aria-disabled="true" title={`No ${CATEGORY_LABEL[t.category]} chapter on your sheet`}>
                {CATEGORY_LABEL[t.category]}
                <span className="rx-cat-tab-n rx-num">0</span>
              </span>
            )
          )}
        </nav>
        <nav className="rx-stack" style={{ gap: 8 }} aria-label="Chapters on your sheet">
          <div className="rx-spread">
            <span className="rx-eyebrow">
              {CATEGORY_LABEL[current.category]} · chapter {index + 1} of {inCat.length} · {doneCount} submitted
            </span>
          </div>
          <div className="rx-deck-strip">
            {inCat.map((n, i) => {
              const s = mine.get(n.id);
              const st = s?.status === "submitted" ? "submitted" : s ? "draft" : "none";
              return (
                <Link
                  key={n.id}
                  href={href(n.id)}
                  className="rx-deck-dot"
                  data-state={st}
                  aria-current={n.id === current.id ? "true" : undefined}
                  title={`${nameOf(n.chapter_id)} · ${st === "submitted" ? "submitted" : st === "draft" ? "draft saved" : "not started"}`}
                  aria-label={`${i + 1}. ${nameOf(n.chapter_id)}, ${st === "submitted" ? "submitted" : st === "draft" ? "draft saved" : "not started"}`}
                >
                  {i + 1}
                </Link>
              );
            })}
          </div>
          <div className="rx-sheet-nav">
            {prev ? (
              <Link href={href(prev.id)} className="rx-btn rx-btn-quiet rx-btn-sm">
                <IconArrowLeft size={16} /> Previous
              </Link>
            ) : <span />}
            {next ? (
              <Link href={href(next.id)} className="rx-btn rx-btn-quiet rx-btn-sm">
                Next <IconArrowRight size={16} />
              </Link>
            ) : <span />}
          </div>
        </nav>

        {added && open && !submitted ? (
          <Notice>
            National Leadership added this chapter during re-evaluation, and both checkers passed it. Score it by{" "}
            {formatWhen(cycle.reevaluation_deadline)}.
          </Notice>
        ) : null}
        {curWin.state === "closed" ? (
          <Notice>
            Scoring closed on {formatWhen(rescore ? cycle.stage2_deadline : scoringDeadlineFor(cycle, current))}. Read-only
            mode.
          </Notice>
        ) : curWin.state === "over" ? (
          <Notice>Stage 1 is over for this recognition. Read-only mode.</Notice>
        ) : submitted ? (
          <Notice tone="ok">
            <span className="rx-row" style={{ gap: 8 }}>
              <IconLock size={16} /> Read-only mode. You submitted these marks on {formatWhen(score?.submitted_at)}.
            </span>
          </Notice>
        ) : null}

        <div className="rx-sheet">
          {/* ---------------- Dossier ---------------- */}
          <article className="rx-plate rx-stack rx-sheet-dossier" aria-labelledby="rx-dossier-h">
            <div className="rx-eyebrow">Dossier</div>
            <div className="rx-stack" style={{ gap: 6 }}>
              <h2 className="rx-h2" id="rx-dossier-h">{nameOf(current.chapter_id)}</h2>
              {state.homeByDuty.get(duty.id)?.has(current.chapter_id) ? (
                <div className="rx-small rx-home-note">
                  Your home chapter. Score it as usual; everyone reviewing the marks sees it noted as your home chapter.
                </div>
              ) : null}
              <div className="rx-row" style={{ gap: 8 }}>
                <Seal tone="mute">Region {current.region}</Seal>
                <Seal tone="laurel">{CATEGORY_LABEL[current.category]}</Seal>
                {duty.layer === "nmt" && current.rm_recommended_by ? <Seal tone="gilt">Recommended by RM</Seal> : null}
                {addedFor && addedBy ? <Seal tone="gilt">Added by {addedBy}</Seal> : null}
              </div>
            </div>

            {addedFor ? (
              <section className="rx-stack" style={{ gap: 8 }}>
                <h3 className="rx-h3">Why {addedBy ?? "someone"} added this chapter</h3>
                <p className="rx-sheet-field">{current.added_reason || <span className="rx-mute">No reason recorded</span>}</p>
                <p className="rx-small rx-mute">
                  This chapter did not nominate, so there is no nomination form. Score it on what you know of its work
                  and the National Health Card.
                </p>
              </section>
            ) : (current.justification ?? "").trim() !== "" || !legacyNomination(current) ? (
              // recognitions_04: the nomination is the chapter's one "why".
              <section className="rx-stack" style={{ gap: 8 }}>
                <h3 className="rx-h3">Why they should get this recognition</h3>
                <p className="rx-sheet-field" style={{ whiteSpace: "pre-line" }}>
                  {(current.justification ?? "").trim() || <span className="rx-mute">Left blank</span>}
                </p>
              </section>
            ) : (
              // Filed on the older form: show only the sections it has.
              <>
                {current.reasons.some((r) => r.trim() !== "") ? (
                  <section className="rx-stack" style={{ gap: 8 }}>
                    <h3 className="rx-h3">Why they should get this recognition</h3>
                    <ol className="rx-sheet-reasons">
                      {current.reasons
                        .filter((r) => r.trim() !== "")
                        .map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                    </ol>
                  </section>
                ) : null}

                {current.flagship_event ? (
                  <section className="rx-stack" style={{ gap: 6 }}>
                    <h3 className="rx-h3">Flagship event</h3>
                    <p className="rx-sheet-field">{current.flagship_event}</p>
                  </section>
                ) : null}

                {current.hosted_event ? (
                  <section className="rx-stack" style={{ gap: 6 }}>
                    <h3 className="rx-h3">Hosted a national or regional event</h3>
                    <p className="rx-sheet-field">
                      Yes · {current.hosted_event_name || "Name not given"}
                      {current.hosted_event_type ? ` (${current.hosted_event_type === "national" ? "National" : "Regional"})` : ""}
                    </p>
                  </section>
                ) : null}

                {current.announcement_draft ? (
                  <section className="rx-stack" style={{ gap: 6 }}>
                    <h3 className="rx-h3">Their announcement draft</h3>
                    <p className="rx-sheet-field">{current.announcement_draft}</p>
                  </section>
                ) : null}
              </>
            )}

            <hr className="rx-rule" />

            {duty.layer === "rm" ? (
              <FlagToggle
                key={`rec-${current.id}`}
                kind="recommend"
                evaluatorId={duty.id}
                nominationId={current.id}
                on={!!current.rm_recommended_by}
                disabled={!open || (!!current.rm_recommended_by && current.rm_recommended_by !== personId)}
                note={
                  current.rm_recommended_by
                    ? current.rm_recommended_by === personId
                      ? `You recommended this chapter on ${formatWhen(current.rm_recommended_at)}. Click to withdraw.`
                      : "Another Regional Mentor has recommended this chapter."
                    : "Optional. It doesn't change anyone's marks."
                }
              />
            ) : current.rm_recommended_by ? (
              <FlagToggle
                key={`app-${current.id}`}
                kind="approve"
                evaluatorId={duty.id}
                nominationId={current.id}
                on={!!current.nmt_approved_by}
                disabled={!open || (!!current.nmt_approved_by && current.nmt_approved_by !== personId)}
                note={
                  current.nmt_approved_by
                    ? current.nmt_approved_by === personId
                      ? `You approved this on ${formatWhen(current.nmt_approved_at)}. Click to withdraw.`
                      : "Another NMT member has approved this recommendation."
                    : "Optional. It doesn't change anyone's marks."
                }
              />
            ) : (
              <p className="rx-small rx-mute">No Regional Mentor has recommended this chapter to the NMT.</p>
            )}

            <hr className="rx-rule" />

            <section className="rx-stack" style={{ gap: 8 }}>
              <h3 className="rx-h3">National Health Card</h3>
              <HealthCardPanel tableKey={hc.tableKey} measures={hc.measures} card={hcCard} weightLayer1={cycle.weight_layer1} />
              {files.length === 0 ? (
                <p className="rx-small rx-mute">The National Health Card for this recognition hasn&apos;t been uploaded yet.</p>
              ) : (
                <ul className="rx-stack" style={{ gap: 6, listStyle: "none", padding: 0, margin: 0 }}>
                  {files.map((f) => (
                    <li key={f.id}>
                      <a
                        href={`/api/recognitions/health-card/${f.id}`}
                        target="_blank"
                        rel="noopener"
                        className="rx-link rx-row"
                        style={{ gap: 6, flexWrap: "nowrap", overflowWrap: "anywhere" }}
                      >
                        <IconDownload size={16} /> Download {f.file_name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </article>

          {/* ---------------- Your marks ---------------- */}
          <ScoreSheet
            key={current.id}
            evaluatorId={duty.id}
            nominationId={current.id}
            chapterName={nameOf(current.chapter_id)}
            layer={duty.layer}
            initialParams={initialParams}
            initialReasons={score?.reasons ?? []}
            initialComments={score?.additional_comments ?? ""}
            readOnly={readOnly}
          />
        </div>
      </div>
    </div>
  );
}
