import { requireRxSuperAdmin } from "@/lib/recognitions/auth";
import { getCurrentCycle, listCycles } from "@/lib/recognitions/data";
import { NoAccess, PageHead, Seal, formatWhen } from "../../../_ui/primitives";
import { isoToIstInput } from "../_lib/ist";
import { CreateCycleForm, CycleSettingsForm, MakeCurrentButton } from "./timeline-forms";

export const metadata = { title: "Timeline" };

export default async function TimelinePage() {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return <NoAccess reason={gate.error} />;

  const [cycle, cycles] = await Promise.all([getCurrentCycle(), listCycles()]);

  return (
    <div className="rx-stack-lg">
      <PageHead eyebrow="Control room" title="Timeline and weights">
        <p className="rx-mute">
          All times are India time (IST). A nomination, score or moderation locks when its deadline passes.
        </p>
      </PageHead>

      {cycle ? (
        <section className="rx-plate rx-stack">
          <div className="rx-spread">
            <h2 className="rx-h2">{cycle.name}</h2>
            <Seal tone="laurel">Current cycle</Seal>
          </div>
          <CycleSettingsForm
            cycle={{
              id: cycle.id,
              name: cycle.name,
              nominationDeadline: isoToIstInput(cycle.nomination_deadline),
              fixDeadline: isoToIstInput(cycle.fix_deadline),
              checkDeadline: isoToIstInput(cycle.check_deadline),
              stage1Deadline: isoToIstInput(cycle.stage1_deadline),
              stage2Deadline: isoToIstInput(cycle.stage2_deadline),
              reevaluationDeadline: isoToIstInput(cycle.reevaluation_deadline),
              weight1: cycle.weight_layer1,
              weight2: cycle.weight_layer2,
              weight3: cycle.weight_layer3,
              layer2Mode: cycle.layer2_mode,
              quizOpen: cycle.quiz_open,
            }}
          />
        </section>
      ) : (
        <section className="rx-plate">
          <p>No cycle is current. Create one below and tick &ldquo;Make it the current cycle&rdquo;.</p>
        </section>
      )}

      <section className="rx-stack">
        <h2 className="rx-h2">All cycles</h2>
        {cycles.length === 0 ? (
          <p className="rx-mute">No cycles yet.</p>
        ) : (
          <div className="rx-ledger-wrap">
            <table className="rx-ledger">
              <thead>
                <tr>
                  <th>Cycle</th>
                  <th className="rx-num">Yi year</th>
                  <th>Nominations close</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cycles.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="rx-num">{c.yi_year}</td>
                    <td className="rx-num">{formatWhen(c.nomination_deadline)}</td>
                    <td>{c.is_current ? <Seal tone="laurel">Current</Seal> : <MakeCurrentButton cycleId={c.id} name={c.name} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rx-plate rx-stack">
        <h2 className="rx-h2">Create a cycle</h2>
        <CreateCycleForm defaultYear={new Date().getFullYear()} />
      </section>
    </div>
  );
}
