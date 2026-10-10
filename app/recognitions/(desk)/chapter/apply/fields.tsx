"use client";

import { WORDS } from "@/lib/recognitions/constants";
import { WordField } from "../../../_ui/client";
import type { NominationForm } from "../shared";

/**
 * Sections A-D of one nomination, editable. Shared by the apply wizard and
 * the "sent back" fix form (recognitions_02) so both write the same fields
 * with the same limits.
 */
export function NominationFields({
  idPrefix,
  form: f,
  onChange,
}: {
  idPrefix: string;
  form: NominationForm;
  onChange: (change: Partial<NominationForm>) => void;
}) {
  return (
    <>
      <fieldset className="rx-stack" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="rx-eyebrow">Section A · Five reasons we deserve this award</legend>
        {f.reasons.map((r, i) => (
          <WordField
            key={i}
            label={`Reason ${i + 1}`}
            value={r}
            limit={WORDS.nominationReason}
            rows={3}
            onChange={(v) => onChange({ reasons: f.reasons.map((x, j) => (j === i ? v : x)) })}
          />
        ))}
      </fieldset>

      <fieldset className="rx-stack" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="rx-eyebrow">Section B · Flagship event</legend>
        <WordField
          label="Event name and impact"
          help="One event only."
          value={f.flagship}
          limit={WORDS.flagshipEvent}
          rows={3}
          onChange={(v) => onChange({ flagship: v })}
        />
      </fieldset>

      <fieldset className="rx-stack" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="rx-eyebrow">Section C · Hosted a national or regional event</legend>
        <p className="rx-small">Did your chapter host a national or regional event related to this vertical?</p>
        <div className="rx-row" role="radiogroup" aria-label="Hosted a national or regional event">
          {[
            { v: true, label: "Yes" },
            { v: false, label: "No" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={f.hosted === o.v}
              className="rx-tile"
              style={{ width: "auto", flex: "1 1 120px", justifyContent: "center" }}
              onClick={() => onChange({ hosted: o.v })}
            >
              {o.label}
            </button>
          ))}
        </div>
        {f.hosted ? (
          <div className="rx-stack">
            <div>
              <label className="rx-label" htmlFor={`hosted-name-${idPrefix}`}>Event name</label>
              <input
                id={`hosted-name-${idPrefix}`}
                className="rx-input"
                value={f.hostedName}
                onChange={(e) => onChange({ hostedName: e.target.value })}
              />
            </div>
            <div>
              <div className="rx-label" id={`hosted-type-${idPrefix}`}>Type</div>
              <div className="rx-row" role="radiogroup" aria-labelledby={`hosted-type-${idPrefix}`}>
                {(["national", "regional"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={f.hostedType === t}
                    className="rx-tile"
                    style={{ width: "auto", flex: "1 1 120px", justifyContent: "center" }}
                    onClick={() => onChange({ hostedType: t })}
                  >
                    {t === "national" ? "National" : "Regional"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </fieldset>

      <fieldset className="rx-stack" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="rx-eyebrow">Section D · Award announcement draft</legend>
        <WordField
          label="Announcement"
          help="If our chapter wins, this is how we would like the award to be announced."
          value={f.announcement}
          limit={WORDS.announcementDraft}
          rows={6}
          onChange={(v) => onChange({ announcement: v })}
        />
      </fieldset>
    </>
  );
}
