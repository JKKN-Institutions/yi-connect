import Link from "next/link";
import { getRxViewer } from "@/lib/recognitions/auth";
import { getCurrentCycle, listAwards } from "@/lib/recognitions/data";
import { Ribbon } from "../_ui/ribbon";
import { IconArrowRight } from "../_ui/icons";
import { Deadline, NoAccess, PageHead } from "../_ui/primitives";
import { desksFor } from "./desks";

const DESK_COPY: Record<string, string> = {
  "/recognitions/chapter": "Apply for awards, write your case and make your predictions.",
  "/recognitions/score": "Score the nominations assigned to you. Your marks stay private.",
  "/recognitions/moderate": "Once every score is in, review the combined matrix and the podium.",
  "/recognitions/review": "Read the Stage 1 and Stage 2 summaries and approve or send back.",
  "/recognitions/admin": "Timelines, awards, evaluators, Health Card files, citations and reports.",
};

export default async function DesksHome() {
  const viewer = await getRxViewer();
  if (!viewer) return null; // the layout already rendered the no-access panel
  const desks = desksFor(viewer);
  const cycle = await getCurrentCycle();
  const awards = cycle ? await listAwards(cycle.id) : [];

  if (desks.length === 0) {
    return (
      <NoAccess reason="Your Yi account has no Recognitions role yet. Chapter chairs get in automatically; evaluators and leadership are added by the Recognitions super admin." />
    );
  }

  return (
    <div className="rx-stack-lg">
      <PageHead eyebrow={cycle ? `${cycle.name}` : "No cycle open"} title="Your desks">
        {cycle ? (
          <div className="rx-stack" style={{ gap: 4 }}>
            <Deadline label="Nominations close" iso={cycle.nomination_deadline} />
            <Deadline label="Stage 1 scoring closes" iso={cycle.stage1_deadline} />
          </div>
        ) : (
          <p className="rx-mute">The Recognitions super admin hasn&apos;t opened a cycle yet.</p>
        )}
      </PageHead>

      <div className="rx-grid">
        {desks.map((d) => (
          <Link key={d.href} href={d.href} className="rx-plate rx-stack" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="rx-spread">
              <h2 className="rx-h2">{d.label}</h2>
              <IconArrowRight />
            </div>
            <p className="rx-mute rx-small">{DESK_COPY[d.href]}</p>
          </Link>
        ))}
      </div>

      {awards.length > 0 ? (
        <section className="rx-stack">
          <div className="rx-eyebrow">This year&apos;s awards</div>
          <div className="rx-row" style={{ gap: 18 }}>
            {awards.map((a) => (
              <span key={a.id} className="rx-row rx-small" style={{ gap: 8 }}>
                <Ribbon vertical={a.vertical} /> {a.title}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
