import { NEM_LABEL } from "@/lib/recognitions/attendance";
import type { AttendanceSummary } from "@/lib/recognitions/attendance-data";

/**
 * Read-only "Attendance at the Stage 2 meeting" for a submitted moderation
 * version (recognitions_09). Shown only where that ranking is shown.
 */
export function AttendanceView({ summary, version }: { summary: AttendanceSummary; version: number }) {
  return (
    <section className="rx-stack" style={{ gap: 8, minWidth: 0 }} data-testid="stage2-attendance-view">
      <h3 className="rx-h3">Attendance at the Stage 2 meeting</h3>
      {!summary.recorded ? (
        <p className="rx-small rx-mute">Not recorded: version {version} was submitted before attendance was added.</p>
      ) : summary.nobody ? (
        <p className="rx-small">The NMT leader recorded that nobody attended.</p>
      ) : (
        <>
          <p className="rx-small rx-mute" style={{ margin: 0 }}>
            As the NMT leader confirmed with version {version}.
          </p>
          <ul className="rx-small" style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 6 }}>
            {summary.lines.map((l, i) => (
              <li key={i} style={{ display: "flex", gap: 8, minWidth: 0 }}>
                <span aria-hidden style={{ flex: "none", width: 16 }}>{l.attended ? "✓" : "–"}</span>
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  <strong>{l.name}</strong>
                  {l.role ? <span className="rx-mute"> {l.role}</span> : null}
                  <span className={l.attended ? "" : "rx-mute"}>{l.attended ? " · attended" : " · not ticked"}</span>
                </span>
              </li>
            ))}
            <li style={{ display: "flex", gap: 8, minWidth: 0 }}>
              <span aria-hidden style={{ flex: "none", width: 16 }}>{summary.nem ? "✓" : "–"}</span>
              <span style={{ minWidth: 0 }}>
                <strong>{NEM_LABEL}</strong>
                <span className={summary.nem ? "" : "rx-mute"}>{summary.nem ? " · ticked" : " · not ticked"}</span>
              </span>
            </li>
          </ul>
        </>
      )}
    </section>
  );
}
