import Link from "next/link";
import { requireRxSuperAdmin } from "@/lib/recognitions/auth";
import { getCurrentCycle, listAwards } from "@/lib/recognitions/data";
import { VERTICALS } from "@/lib/recognitions/constants";
import { NoAccess, PageHead } from "../../../_ui/primitives";
import { AddAllAwardsButton, AwardForm } from "./award-forms";

export const metadata = { title: "Awards" };

export default async function AwardsPage() {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return <NoAccess reason={gate.error} />;
  const cycle = await getCurrentCycle();
  if (!cycle) {
    return (
      <div className="rx-stack-lg">
        <PageHead eyebrow="Control room" title="Awards" />
        <div className="rx-plate rx-stack">
          <p>Open a cycle first; awards belong to a cycle.</p>
          <div><Link className="rx-btn" href="/recognitions/admin/timeline">Go to Timeline</Link></div>
        </div>
      </div>
    );
  }
  const awards = await listAwards(cycle.id, true);
  const taken = new Set(awards.map((a) => a.vertical));
  const free = VERTICALS.filter((v) => !taken.has(v));

  return (
    <div className="rx-stack-lg">
      <PageHead eyebrow={`Control room · ${cycle.name}`} title="Awards">
        <p className="rx-mute">One award per vertical. Each crowns a winner, runner-up and second runner-up in every chapter category.</p>
      </PageHead>

      {free.length > 0 ? (
        <div className="rx-plate rx-spread">
          <p className="rx-small">
            {awards.length === 0 ? "No awards yet." : `${free.length} vertical${free.length === 1 ? " has" : "s have"} no award yet.`} Add the missing ones as
            &ldquo;&lt;Vertical&gt; Excellence&rdquo; and rename later.
          </p>
          <AddAllAwardsButton missing={free.length} />
        </div>
      ) : null}

      <div className="rx-stack">
        {awards.map((a) => (
          <AwardForm
            key={a.id}
            award={{ id: a.id, vertical: a.vertical, title: a.title, criteria: a.criteria ?? "", sortOrder: a.sort_order, isActive: a.is_active }}
            freeVerticals={[]}
          />
        ))}
      </div>

      {free.length > 0 ? (
        <section className="rx-stack">
          <h2 className="rx-h2">Add an award</h2>
          <AwardForm award={null} freeVerticals={free} />
        </section>
      ) : null}
    </div>
  );
}
