import type { Vertical } from "@/lib/recognitions/constants";
import { Ribbon } from "../../_ui/ribbon";
import { Seal } from "../../_ui/primitives";
import type { NominationForm } from "./shared";

/** Read-only view of one nomination: used by the review step and the closed view. */
export function NominationSummary({
  title,
  vertical,
  form,
  status,
  note,
}: {
  title: string;
  vertical: Vertical;
  form: NominationForm;
  status: "draft" | "submitted" | "new";
  note?: string;
}) {
  const blank = <span className="rx-mute">Not written yet</span>;
  return (
    <article className="rx-plate rx-plate-tight rx-stack">
      <div className="rx-spread">
        <div className="rx-row" style={{ gap: 10 }}>
          <Ribbon vertical={vertical} size="lg" />
          <h3 className="rx-h3">{title}</h3>
        </div>
        {status === "submitted" ? (
          <Seal tone="laurel">Submitted</Seal>
        ) : status === "draft" ? (
          <Seal tone="gilt">Draft</Seal>
        ) : (
          <Seal tone="mute">Not saved</Seal>
        )}
      </div>
      {note ? <p className="rx-small rx-mute">{note}</p> : null}
      <div>
        <div className="rx-label">A · Five reasons we deserve this award</div>
        <ol className="rx-small" style={{ margin: 0, paddingLeft: 20 }}>
          {form.reasons.map((r, i) => (
            <li key={i} style={{ marginTop: 4, overflowWrap: "anywhere" }}>{r.trim() ? r : blank}</li>
          ))}
        </ol>
      </div>
      <div>
        <div className="rx-label">B · Flagship event</div>
        <p className="rx-small" style={{ overflowWrap: "anywhere" }}>{form.flagship.trim() ? form.flagship : blank}</p>
      </div>
      <div>
        <div className="rx-label">C · Hosted a national or regional event</div>
        <p className="rx-small">
          {form.hosted
            ? `Yes · ${form.hostedName.trim() || "name not given"} · ${
                form.hostedType === "national" ? "National" : form.hostedType === "regional" ? "Regional" : "type not given"
              }`
            : "No"}
        </p>
      </div>
      <div>
        <div className="rx-label">D · Announcement draft</div>
        <p className="rx-small" style={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
          {form.announcement.trim() ? form.announcement : blank}
        </p>
      </div>
    </article>
  );
}
