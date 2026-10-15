import { CHECK_STEP_ENABLED, type AwardKind, type Vertical } from "@/lib/recognitions/constants";
import { Ribbon } from "../../_ui/ribbon";
import { Seal } from "../../_ui/primitives";
import { isLegacyForm, type NominationForm } from "./shared";
import { NOMINATION_STATUS_LABEL } from "@/lib/recognitions/check-rules";
import type { NominationStatus } from "@/lib/recognitions/types";

export const STATUS_TONE: Record<NominationStatus, "laurel" | "gilt" | "vermilion" | "mute"> = {
  draft: "gilt",
  submitted: "laurel",
  returned: "vermilion",
  checked: "laurel",
  excluded: "mute",
};

/**
 * Read-only view of one nomination. A 2026 nomination (recognitions_04) is
 * its "why"; one filed on the older form shows the old sections instead,
 * and only the ones it has.
 */
export function NominationSummary({
  title,
  vertical,
  kind,
  form,
  status,
  note,
}: {
  title: string;
  vertical: Vertical;
  kind?: AwardKind | null;
  form: NominationForm;
  /** The EFFECTIVE status (check-rules effectiveStatus), or "new" for an unsaved form. */
  status: NominationStatus | "new";
  note?: string;
}) {
  const blank = <span className="rx-mute">Not written yet</span>;
  const legacy = isLegacyForm(form);
  const reasons = form.reasons.filter((r) => r.trim() !== "");
  return (
    <article className="rx-plate rx-plate-tight rx-stack">
      <div className="rx-spread">
        <div className="rx-row" style={{ gap: 10, minWidth: 0 }}>
          <Ribbon vertical={vertical} kind={kind} size="lg" />
          <h3 className="rx-h3" style={{ overflowWrap: "anywhere" }}>{title}</h3>
        </div>
        {status === "new" ? (
          <Seal tone="mute">Not saved</Seal>
        ) : (
          <Seal tone={STATUS_TONE[status]}>
            {status === "submitted" && CHECK_STEP_ENABLED ? "Submitted · awaiting checks" : NOMINATION_STATUS_LABEL[status]}
          </Seal>
        )}
      </div>
      {note ? <p className="rx-small rx-mute">{note}</p> : null}
      {!legacy ? (
        <div>
          <div className="rx-label">Why your chapter should get this recognition</div>
          <p className="rx-small" style={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
            {form.justification.trim() ? form.justification : blank}
          </p>
        </div>
      ) : (
        <>
          {reasons.length > 0 ? (
            <div>
              <div className="rx-label">Reasons your chapter gave</div>
              <ol className="rx-small" style={{ margin: 0, paddingLeft: 20 }}>
                {reasons.map((r, i) => (
                  <li key={i} style={{ marginTop: 4, overflowWrap: "anywhere" }}>{r}</li>
                ))}
              </ol>
            </div>
          ) : null}
          {form.flagship.trim() ? (
            <div>
              <div className="rx-label">Flagship event</div>
              <p className="rx-small" style={{ overflowWrap: "anywhere" }}>{form.flagship}</p>
            </div>
          ) : null}
          {form.hosted ? (
            <div>
              <div className="rx-label">Hosted a national or regional event</div>
              <p className="rx-small">
                {`Yes · ${form.hostedName.trim() || "name not given"} · ${
                  form.hostedType === "national" ? "National" : form.hostedType === "regional" ? "Regional" : "type not given"
                }`}
              </p>
            </div>
          ) : null}
          {form.announcement.trim() ? (
            <div>
              <div className="rx-label">Announcement draft</div>
              <p className="rx-small" style={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{form.announcement}</p>
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}
