import Link from "next/link";
import { requireRxSuperAdmin } from "@/lib/recognitions/auth";
import { getCurrentCycle, listAwards } from "@/lib/recognitions/data";
import { KNOWN_RECOGNITIONS } from "@/lib/recognitions/constants";
import { NoAccess, PageHead } from "../../../_ui/primitives";
import { AddAllAwardsButton, AwardForm } from "./award-forms";

export const metadata = { title: "Recognitions" };

export default async function AwardsPage() {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return <NoAccess reason={gate.error} />;
  const cycle = await getCurrentCycle();
  if (!cycle) {
    return (
      <div className="rx-stack-lg">
        <PageHead eyebrow="Control room" title="Recognitions" />
        <div className="rx-plate rx-stack">
          <p>Open a cycle first; recognitions belong to a cycle.</p>
          <div><Link className="rx-btn" href="/recognitions/admin/timeline">Go to Timeline</Link></div>
        </div>
      </div>
    );
  }
  const awards = await listAwards(cycle.id, true);
  const taken = new Set(awards.map((a) => a.vertical));
  const missing = KNOWN_RECOGNITIONS.filter((r) => r.current && !taken.has(r.slug));

  return (
    <div className="rx-stack-lg">
      <PageHead eyebrow={`Control room · ${cycle.name}`} title="Recognitions">
        <p className="rx-mute">
          Each recognition gives a Gold, Silver and Bronze in every chapter category. Rename any of
          them, set its kind (it groups the chapters&apos; list), or add a new one below.
        </p>
      </PageHead>

      {missing.length > 0 ? (
        <div className="rx-plate rx-spread">
          <p className="rx-small">
            {awards.length === 0
              ? "No recognitions yet."
              : `${missing.length} of this year's recognitions ${missing.length === 1 ? "is" : "are"} not added yet: ${missing.map((m) => m.title).join(", ")}.`}{" "}
            Add them with their usual names and rename later.
          </p>
          <AddAllAwardsButton missing={missing.length} />
        </div>
      ) : null}

      <div className="rx-stack">
        {awards.map((a) => (
          <AwardForm
            key={a.id}
            award={{
              id: a.id,
              vertical: a.vertical,
              kind: a.kind ?? "",
              title: a.title,
              criteria: a.criteria ?? "",
              sortOrder: a.sort_order,
              isActive: a.is_active,
            }}
          />
        ))}
      </div>

      <section className="rx-stack">
        <h2 className="rx-h2">Add a recognition</h2>
        <AwardForm award={null} suggestions={missing.map((m) => ({ slug: m.slug, kind: m.kind, title: m.title }))} />
      </section>
    </div>
  );
}
