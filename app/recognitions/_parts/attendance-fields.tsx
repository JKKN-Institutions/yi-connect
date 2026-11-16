"use client";

import { NEM_LABEL, type Attendance, type AttendanceOption } from "@/lib/recognitions/attendance";

export const EMPTY_ATTENDANCE: Attendance = { evaluator_ids: [], nem: false, nobody: false };

const box: React.CSSProperties = { width: 20, height: 20, flex: "none", marginTop: 2, accentColor: "var(--rx-laurel)" };
const row: React.CSSProperties = { display: "flex", gap: 10, alignItems: "flex-start", minWidth: 0, cursor: "pointer" };
const text: React.CSSProperties = { minWidth: 0, overflowWrap: "anywhere" };

/**
 * "Attendance at the Stage 2 meeting" (Piyush, 16 Nov 2026): one checkbox per
 * evaluator of this recognition by name, one NEM box, and an explicit
 * "Nobody attended". Ticking a person or NEM clears "Nobody attended" and
 * the other way round. The leader must answer before submitting.
 */
export function AttendanceFields({
  options,
  value,
  onChange,
  disabled,
}: {
  options: AttendanceOption[];
  value: Attendance;
  onChange: (next: Attendance) => void;
  disabled?: boolean;
}) {
  const ticked = new Set(value.evaluator_ids);
  const isOn = (o: AttendanceOption) => o.evaluatorIds.some((id) => ticked.has(id));
  const toggle = (o: AttendanceOption, on: boolean) => {
    const next = new Set(ticked);
    for (const id of o.evaluatorIds) {
      if (on) next.add(id);
      else next.delete(id);
    }
    onChange({ ...value, evaluator_ids: [...next].sort(), nobody: false });
  };
  const count = options.filter(isOn).length + (value.nem ? 1 : 0);

  return (
    <fieldset className="rx-plate rx-plate-tight rx-stack" style={{ margin: 0, minWidth: 0 }} data-testid="stage2-attendance">
      <legend className="rx-h3" style={{ padding: "0 4px" }}>Attendance at the Stage 2 meeting</legend>
      <p className="rx-small rx-mute" style={{ margin: 0 }}>
        Tick everyone who attended the meeting. Required before you submit; it goes to National Leadership with the
        ranking and into the report for this vertical.
      </p>
      <div className="rx-stack" style={{ gap: 10 }}>
        {options.map((o) => (
          <label key={o.key} style={row}>
            <input
              type="checkbox"
              style={box}
              checked={isOn(o)}
              disabled={disabled}
              onChange={(e) => toggle(o, e.target.checked)}
            />
            <span style={text}>
              <strong>{o.name}</strong> <span className="rx-small rx-mute">{o.role}</span>
            </span>
          </label>
        ))}
        <label style={row}>
          <input
            type="checkbox"
            style={box}
            checked={value.nem}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, nem: e.target.checked, nobody: false })}
          />
          <span style={text}>
            <strong>{NEM_LABEL}</strong>
          </span>
        </label>
        <hr className="rx-rule" style={{ margin: "2px 0" }} />
        <label style={row}>
          <input
            type="checkbox"
            style={box}
            checked={value.nobody}
            disabled={disabled}
            onChange={(e) =>
              onChange(e.target.checked ? { evaluator_ids: [], nem: false, nobody: true } : { ...value, nobody: false })
            }
          />
          <span style={text}>Nobody attended</span>
        </label>
      </div>
      <p className="rx-small rx-mute" style={{ margin: 0 }} aria-live="polite">
        {value.nobody ? "Recorded: nobody attended." : count === 0 ? "Nothing ticked yet." : `${count} ticked.`}
      </p>
    </fieldset>
  );
}
