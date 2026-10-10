import Link from "next/link";
import { requireRxSuperAdmin } from "@/lib/recognitions/auth";
import { getAwardState, getCurrentCycle, listAwards } from "@/lib/recognitions/data";
import { PHASE_LABEL } from "@/lib/recognitions/phase";
import { effectiveStatus } from "@/lib/recognitions/check-rules";
import type { NominationStatus } from "@/lib/recognitions/types";
import { Ribbon } from "../../_ui/ribbon";
import { Deadline, NoAccess, Notice, PageHead, PhaseSeal, formatWhen } from "../../_ui/primitives";
import { ForceOpenStage2 } from "./force-open";

export const metadata = { title: "Control room" };

function Progress({ label, submitted, required }: { label: string; submitted: number; required: number }) {
  const pctDone = required === 0 ? 0 : Math.round((submitted / required) * 100);
  return (
    <div>
      <div className="rx-spread rx-small">
        <span>{label}</span>
        <span className="rx-num">
          {submitted} / {required} sheets submitted
        </span>
      </div>
      <div className="rx-ad-bar" data-done={required > 0 && submitted >= required}>
        <span style={{ width: `${pctDone}%` }} />
      </div>
    </div>
  );
}

export default async function ControlRoomOverview() {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return <NoAccess reason={gate.error} />;

  const cycle = await getCurrentCycle();
  if (!cycle) {
    return (
      <div className="rx-stack-lg">
        <PageHead eyebrow="Control room" title="No cycle is open yet" />
        <div className="rx-plate rx-stack">
          <p>Start by creating this year&apos;s cycle and setting its deadlines. Then add the awards, classify chapters and assign evaluators.</p>
          <div>
            <Link href="/recognitions/admin/timeline" className="rx-btn">Create a cycle</Link>
          </div>
        </div>
      </div>
    );
  }

  const awards = await listAwards(cycle.id);
  const states = (await Promise.all(awards.map((a) => getAwardState(a.id)))).filter((s) => s !== null);

  return (
    <div className="rx-stack-lg">
      <PageHead eyebrow="Control room" title={cycle.name}>
        <div className="rx-stack" style={{ gap: 4 }}>
          <Deadline label="Nominations close" iso={cycle.nomination_deadline} />
          <Deadline label="Sent-back nominations must be fixed by" iso={cycle.fix_deadline} />
          <Deadline label="Regional Chair + RM checks close" iso={cycle.check_deadline} />
          <Deadline label="Stage 1 scoring closes" iso={cycle.stage1_deadline} />
          <Deadline label="Stage 2 moderation closes" iso={cycle.stage2_deadline} />
          <Deadline label="Re-evaluation closes" iso={cycle.reevaluation_deadline} />
        </div>
        <p className="rx-small rx-mute">
          Weights: Layer 1 {cycle.weight_layer1}% · Layer 2 {cycle.weight_layer2}% · Layer 3 {cycle.weight_layer3}% ·
          Layer 2 counted as {cycle.layer2_mode === "percentile" ? "percentile within region" : "raw score"} · Prediction quiz{" "}
          {cycle.quiz_open ? "open" : "closed"}
        </p>
      </PageHead>

      {states.length === 0 ? (
        <div className="rx-plate rx-stack">
          <p>This cycle has no active awards yet.</p>
          <div>
            <Link href="/recognitions/admin/awards" className="rx-btn">Add the awards</Link>
          </div>
        </div>
      ) : null}

      <div className="rx-stack">
        {states.map((st) => {
          const { award, completeness: c } = st;
          // Effective status: sent back past the fix deadline / unchecked past the check deadline = out.
          const count = (s: NominationStatus) => st.nominations.filter((n) => effectiveStatus(n, cycle) === s).length;
          const filed = st.nominations.length - count("draft");
          return (
            <section key={award.id} className="rx-plate rx-ad-award">
              <Ribbon vertical={award.vertical} size="tall" />
              <div className="rx-stack">
                <div className="rx-spread">
                  <h2 className="rx-h2">{award.title}</h2>
                  <PhaseSeal phase={st.phase} />
                </div>
                <p className="rx-small rx-mute">
                  {filed} nomination{filed === 1 ? "" : "s"} filed: {count("checked")} passed both checks ·{" "}
                  {count("submitted")} awaiting checks · {count("returned")} sent back · {count("excluded")} out of the race
                  {count("draft") > 0 ? ` · ${count("draft")} still in draft` : ""} ·{" "}
                  {st.duties.filter((d) => d.layer === "rm").length} RM · {st.duties.filter((d) => d.layer === "nmt").length} NMT
                </p>
                <div className="rx-stack" style={{ gap: 10 }}>
                  <Progress label="Regional Mentors" submitted={c.rm.submitted} required={c.rm.required} />
                  <Progress label="NMT" submitted={c.nmt.submitted} required={c.nmt.required} />
                </div>
                {c.blockers.length > 0 && (st.phase === "stage1" || st.phase === "nominations" || st.phase === "setup") ? (
                  <Notice tone="alert">
                    <strong>Stage 2 can&apos;t open yet:</strong>
                    <ul style={{ margin: "6px 0 0 18px" }}>
                      {c.blockers.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </Notice>
                ) : null}
                {award.stage2_unlocked_at ? (
                  <Notice>
                    Stage 2 opened on {formatWhen(award.stage2_unlocked_at)}.
                    {award.stage2_unlock_reason ? ` Reason: ${award.stage2_unlock_reason}` : ""}
                  </Notice>
                ) : null}
                {st.phase === "stage1" && !award.stage2_unlocked_at ? (
                  <ForceOpenStage2 awardId={award.id} awardTitle={award.title} rm={c.rm} nmt={c.nmt} />
                ) : null}
                {st.phase === "setup" ? (
                  <p className="rx-small rx-mute">
                    {PHASE_LABEL.setup}: set the nomination deadline on the <Link className="rx-link" href="/recognitions/admin/timeline">Timeline</Link> page.
                  </p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
