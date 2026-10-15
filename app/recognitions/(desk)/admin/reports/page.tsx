import { requireRxSuperAdmin } from "@/lib/recognitions/auth";
import { getAwardState, getCurrentCycle, listAwards } from "@/lib/recognitions/data";
import { Ribbon } from "../../../_ui/ribbon";
import { IconDownload } from "../../../_ui/icons";
import { NoAccess, PageHead, PhaseSeal } from "../../../_ui/primitives";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return <NoAccess reason={gate.error} />;
  const cycle = await getCurrentCycle();
  if (!cycle) {
    return (
      <div className="rx-stack-lg">
        <PageHead eyebrow="Control room" title="Reports" />
        <div className="rx-plate"><p>Open a cycle first; reports cover the current cycle.</p></div>
      </div>
    );
  }
  const awards = await listAwards(cycle.id);
  const states = (await Promise.all(awards.map((a) => getAwardState(a.id)))).filter((s) => s !== null);
  const approved = states.filter((s) => s.phase === "finalized").length;
  const pending = states.filter((s) => s.phase === "governance").length;

  return (
    <div className="rx-stack-lg">
      <PageHead eyebrow={`Control room · ${cycle.name}`} title="Reports" />

      <section className="rx-plate rx-plate-gilt rx-stack">
        <h2 className="rx-h2">Recognitions ceremony report</h2>
        <p className="rx-small">
          For every approved recognition, in each category: rank, chapter, recognition, key achievements (the nomination&apos;s five reasons and flagship
          event), citation and announcement text — with your polish applied.
        </p>
        <p className="rx-small rx-mute">
          {approved} of {states.length} recognitions approved{pending ? ` · ${pending} awaiting National Leadership` : ""}.
        </p>
        <form method="get" action="/api/recognitions/reports/ceremony" className="rx-stack" style={{ gap: 12 }}>
          <label className="rx-row" style={{ gap: 10 }}>
            <input type="checkbox" name="include" value="pending" className="rx-ad-check" />
            <span>Also include recognitions awaiting a decision (marked &ldquo;Not yet approved&rdquo;) — for a rehearsal copy</span>
          </label>
          <div className="rx-row">
            <button type="submit" name="format" value="pdf" className="rx-btn rx-btn-gilt">
              <IconDownload size={16} /> Download PDF
            </button>
            <button type="submit" name="format" value="xlsx" className="rx-btn rx-btn-quiet">
              <IconDownload size={16} /> Download Excel
            </button>
          </div>
        </form>
      </section>

      <section className="rx-plate rx-stack">
        <h2 className="rx-h2">Stage sheet</h2>
        <p className="rx-small">
          Every recognition and category with the final 1st, 2nd and 3rd chapters and the NMT&apos;s citation, laid out
          to be read out on stage. Print it or download it as CSV. National Leadership can open it too.
        </p>
        <div>
          <a className="rx-btn rx-btn-quiet" href="/recognitions/admin/stage-sheet">Open the stage sheet</a>
        </div>
      </section>

      <section className="rx-plate rx-stack">
        <h2 className="rx-h2">Recognition-wise report</h2>
        <p className="rx-small">
          One sheet per recognition: the full combined matrix — Layer 1, every Regional Mentor&apos;s and NMT member&apos;s total with their name, the
          counted layers, the combined total, the NMT leader&apos;s final score and rank, and the recognition&apos;s phase.
        </p>
        <div>
          <a className="rx-btn rx-btn-quiet" href="/api/recognitions/reports/verticals?format=xlsx">
            <IconDownload size={16} /> Download Excel
          </a>
        </div>
      </section>

      <section className="rx-stack">
        <div className="rx-eyebrow">Where each recognition stands</div>
        <div className="rx-ledger-wrap">
          <table className="rx-ledger">
            <tbody>
              {states.map((s) => (
                <tr key={s.award.id}>
                  <td>
                    <span className="rx-row" style={{ gap: 8 }}>
                      <Ribbon vertical={s.award.vertical} kind={s.award.kind} /> {s.award.title}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <PhaseSeal phase={s.phase} />
                  </td>
                </tr>
              ))}
              {states.length === 0 ? (
                <tr>
                  <td className="rx-mute">No active recognitions in this cycle.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
