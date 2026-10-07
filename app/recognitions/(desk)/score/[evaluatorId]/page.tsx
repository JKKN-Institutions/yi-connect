import Link from "next/link";
import { requireRxDuty } from "@/lib/recognitions/auth";
import {
  chapterMap,
  getAwardState,
  listHealthCardFiles,
  listScoresForDuty,
  nominationsForDuty,
} from "@/lib/recognitions/data";
import { CATEGORY_LABEL, PARAM_KEYS, type ParamKey } from "@/lib/recognitions/constants";
import { Ribbon } from "../../../_ui/ribbon";
import { IconArrowLeft, IconArrowRight, IconDownload, IconEyeOff, IconLock } from "../../../_ui/icons";
import { Deadline, NoAccess, Notice, PageHead, Seal, formatWhen } from "../../../_ui/primitives";
import { dutyLayerLabel, scoringWindow } from "../score-rules";
import { ScoreSheet } from "./sheet";
import { FlagToggle } from "./flags";
import "../score.css";

export const metadata = { title: "Scoring sheet · Yi Recognitions" };

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
    return <NoAccess reason="This award no longer exists or is no longer active." />;
  }
  const { award, cycle } = state;
  const win = scoringWindow(state.phase, cycle);

  const head = (
    <PageHead eyebrow="Stage 1 · blind scoring" title={award.title}>
      <div className="rx-row" style={{ gap: 10 }}>
        <Ribbon vertical={award.vertical} size="lg" />
        <Seal tone={duty.layer === "rm" ? "laurel" : "gilt"}>{dutyLayerLabel(duty)}</Seal>
        <Link href="/recognitions/score" className="rx-link rx-small">All my sheets</Link>
      </div>
      <Deadline label="Stage 1 closes" iso={cycle.stage1_deadline} />
      <div className="rx-notice">
        <div className="rx-row" style={{ gap: 8, flexWrap: "nowrap", alignItems: "flex-start" }}>
          <IconEyeOff size={18} />
          <span>Your marks are private. Other evaluators can&apos;t see them and you can&apos;t see theirs.</span>
        </div>
      </div>
    </PageHead>
  );

  if (win.state === "notYet") {
    return (
      <div>
        {head}
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
        <div className="rx-plate rx-stack">
          <h2 className="rx-h2">No chapters on your sheet</h2>
          <p className="rx-mute">
            {duty.layer === "rm"
              ? `No chapter in region ${duty.region ?? ""} has submitted a nomination for this award that you can score.`
              : "No chapter has submitted a nomination for this award that you can score."}
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
  const index = visible.findIndex((n) => n.id === current.id);
  const prev = index > 0 ? visible[index - 1] : null;
  const next = index < visible.length - 1 ? visible[index + 1] : null;
  const score = mine.get(current.id) ?? null;
  const submitted = score?.status === "submitted";
  const open = win.state === "open";
  const readOnly = !open || submitted;
  const files = await listHealthCardFiles(duty.award_id);
  const href = (id: string) => `/recognitions/score/${duty.id}?n=${id}`;
  const doneCount = visible.filter((n) => mine.get(n.id)?.status === "submitted").length;

  const initialParams: Partial<Record<ParamKey, number>> = {};
  for (const k of PARAM_KEYS) {
    const v = score?.params?.[k];
    if (typeof v === "number") initialParams[k] = v;
  }

  return (
    <div>
      {head}

      <div className="rx-stack-lg">
        {/* Deck strip: jump between the chapters on this sheet. */}
        <nav className="rx-stack" style={{ gap: 8 }} aria-label="Chapters on your sheet">
          <div className="rx-spread">
            <span className="rx-eyebrow">
              Chapter {index + 1} of {visible.length} · {doneCount} submitted
            </span>
          </div>
          <div className="rx-deck-strip">
            {visible.map((n, i) => {
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

        {win.state === "closed" ? (
          <Notice>Scoring closed on {formatWhen(cycle.stage1_deadline)}. Read-only mode.</Notice>
        ) : win.state === "over" ? (
          <Notice>Stage 1 is over for this award. Read-only mode.</Notice>
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
              <div className="rx-row" style={{ gap: 8 }}>
                <Seal tone="mute">Region {current.region}</Seal>
                <Seal tone="laurel">{CATEGORY_LABEL[current.category]}</Seal>
                {duty.layer === "nmt" && current.rm_recommended_by ? <Seal tone="gilt">Recommended by RM</Seal> : null}
              </div>
            </div>

            <section className="rx-stack" style={{ gap: 8 }}>
              <h3 className="rx-h3">Why they deserve it</h3>
              <ol className="rx-sheet-reasons">
                {current.reasons.map((r, i) => (
                  <li key={i}>{r.trim() === "" ? <span className="rx-mute">Left blank</span> : r}</li>
                ))}
              </ol>
            </section>

            <section className="rx-stack" style={{ gap: 6 }}>
              <h3 className="rx-h3">Flagship event</h3>
              <p className="rx-sheet-field">{current.flagship_event || <span className="rx-mute">Left blank</span>}</p>
            </section>

            <section className="rx-stack" style={{ gap: 6 }}>
              <h3 className="rx-h3">Hosted a national or regional event</h3>
              {current.hosted_event ? (
                <p className="rx-sheet-field">
                  Yes · {current.hosted_event_name || "Name not given"}
                  {current.hosted_event_type ? ` (${current.hosted_event_type === "national" ? "National" : "Regional"})` : ""}
                </p>
              ) : (
                <p>No</p>
              )}
            </section>

            <section className="rx-stack" style={{ gap: 6 }}>
              <h3 className="rx-h3">Their announcement draft</h3>
              <p className="rx-sheet-field">{current.announcement_draft || <span className="rx-mute">Left blank</span>}</p>
            </section>

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
              {files.length === 0 ? (
                <p className="rx-small rx-mute">The National Health Card for this award hasn&apos;t been uploaded yet.</p>
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
