import Link from "next/link";
import type { Metadata } from "next";
import { requireRxOversight } from "@/lib/recognitions/auth";
import { getAwardState, getCurrentCycle, listAwards, type AwardState } from "@/lib/recognitions/data";
import { Ribbon } from "@/app/recognitions/_ui/ribbon";
import { IconArrowRight } from "@/app/recognitions/_ui/icons";
import { NoAccess, PageHead, PhaseSeal, formatWhen } from "@/app/recognitions/_ui/primitives";

export const metadata: Metadata = { title: "Review" };

function AwardLine({ state }: { state: AwardState }) {
  const v = state.latestSubmittedVersion;
  return (
    <Link
      href={`/recognitions/review/${state.award.id}`}
      className="rx-plate rx-plate-tight"
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <div className="rx-spread">
        <div className="rx-row" style={{ gap: 10 }}>
          <Ribbon vertical={state.award.vertical} size="lg" />
          <span className="rx-h2">{state.award.title}</span>
        </div>
        <div className="rx-row" style={{ gap: 8 }}>
          <PhaseSeal phase={state.phase} />
          <IconArrowRight />
        </div>
      </div>
      <p className="rx-small rx-mute" style={{ marginTop: 8 }}>
        {state.submittedNominations.length} submitted nomination{state.submittedNominations.length === 1 ? "" : "s"}
        {v ? ` · version ${v.version} submitted ${formatWhen(v.submitted_at)}` : ""}
      </p>
    </Link>
  );
}

export default async function ReviewList() {
  const gate = await requireRxOversight();
  if (!gate.ok) return <NoAccess reason={gate.error} />;
  const decides = gate.viewer.isNationalLeadership;

  const cycle = await getCurrentCycle();
  if (!cycle) {
    return (
      <div className="rx-stack">
        <PageHead title="Review" />
        <p className="rx-mute">No cycle is open yet. The Recognitions super admin opens one from the Control room.</p>
      </div>
    );
  }
  const awards = await listAwards(cycle.id);
  const states = (await Promise.all(awards.map((a) => getAwardState(a.id)))).filter(
    (s): s is AwardState => s !== null
  );
  const awaiting = states.filter((s) => s.phase === "governance");
  const rest = states.filter((s) => s.phase !== "governance");

  return (
    <div className="rx-stack-lg">
      <PageHead eyebrow={cycle.name} title="Review">
        <p className="rx-mute">
          Stage 1 and Stage 2 summaries for every award.{" "}
          {decides
            ? "Approve an award or send it back to the NMT leader for re-evaluation."
            : "National Leadership approves an award or sends it back; you can read everything."}
        </p>
      </PageHead>

      <section className="rx-stack">
        <div className="rx-eyebrow">{decides ? "Awaiting your decision" : "Awaiting National Leadership"}</div>
        {awaiting.length === 0 ? (
          <p className="rx-mute rx-small">No award is waiting for a decision right now.</p>
        ) : (
          <div className="rx-stack">
            {awaiting.map((s) => (
              <AwardLine key={s.award.id} state={s} />
            ))}
          </div>
        )}
      </section>

      <section className="rx-stack">
        <div className="rx-eyebrow">All awards</div>
        {rest.length === 0 && awaiting.length === 0 ? (
          <p className="rx-mute rx-small">No awards are set up in this cycle yet.</p>
        ) : (
          <div className="rx-stack">
            {rest.map((s) => (
              <AwardLine key={s.award.id} state={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
