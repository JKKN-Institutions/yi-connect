import { CATEGORY_LABEL } from "@/lib/recognitions/constants";
import { NOMINATION_STATUS_LABEL } from "@/lib/recognitions/check-rules";
import { isPast } from "@/lib/recognitions/phase";
import type { CycleRow } from "@/lib/recognitions/types";
import { Ribbon } from "../../_ui/ribbon";
import { Seal, formatWhen } from "../../_ui/primitives";
import { CheckControls } from "./check-controls";
import type { CheckItem, CheckPass } from "./load";
import "../../_parts/parts.css";
import "./check.css";

const GROUPS: Array<{ status: CheckItem["status"]; title: string; empty: string }> = [
  { status: "submitted", title: "Waiting for checks", empty: "Nothing is waiting for a check right now." },
  { status: "returned", title: "Sent back for a fix", empty: "" },
  { status: "checked", title: "Passed both checks", empty: "" },
  { status: "excluded", title: "Out of the race", empty: "" },
];

function PassLine({ seat, pass }: { seat: string; pass: CheckPass }) {
  return (
    <span className="rx-check-pass" data-done={pass ? "true" : "false"}>
      <strong>{seat}:</strong>{" "}
      {pass ? `passed by ${pass.by}${pass.at ? ` · ${formatWhen(pass.at)}` : ""}` : "not yet"}
    </span>
  );
}

function Dossier({ d }: { d: CheckItem["dossier"] }) {
  const blank = <span className="rx-mute">Left blank</span>;
  return (
    <details className="rx-p-fold">
      <summary>
        <span className="rx-small" style={{ fontWeight: 600 }}>Read the nomination</span>
      </summary>
      <div className="rx-p-fold-body rx-small">
        <div>
          <div className="rx-label">A · Five reasons</div>
          <ol className="rx-p-list">
            {d.reasons.map((r, i) => (
              <li key={i} className="rx-p-text">{r.trim() ? r : blank}</li>
            ))}
          </ol>
        </div>
        <div>
          <div className="rx-label">B · Flagship event</div>
          <p className="rx-p-text">{d.flagship.trim() ? d.flagship : blank}</p>
        </div>
        <div>
          <div className="rx-label">C · Hosted a national or regional event</div>
          <p className="rx-p-text">{d.hosted ? `Yes · ${d.hosted}` : "No"}</p>
        </div>
        <div>
          <div className="rx-label">D · Announcement draft</div>
          <p className="rx-p-text">{d.announcement.trim() ? d.announcement : blank}</p>
        </div>
      </div>
    </details>
  );
}

/** What a checker reads for a chapter National Leadership added: its reason, not the five-section form. */
function AddedReason({ a }: { a: NonNullable<CheckItem["nlAdded"]> }) {
  return (
    <div className="rx-notice rx-small rx-check-added">
      <strong>Why National Leadership added this chapter</strong>
      <p className="rx-p-quote" style={{ marginTop: 6 }}>{a.reason}</p>
      <p className="rx-mute" style={{ marginTop: 6 }}>
        Added by {a.by}
        {a.at ? ` · ${formatWhen(a.at)}` : ""}. The chapter did not nominate, so there is no nomination form to read:
        check that the chapter is eligible for this award.
      </p>
    </div>
  );
}

/** The Check desk list. Server component; the buttons are the client CheckControls. */
export function CheckList({ items, cycle }: { items: CheckItem[]; cycle: CycleRow }) {
  const fixClosed = isPast(cycle.fix_deadline);
  return (
    <div className="rx-stack-lg">
      {GROUPS.map((g) => {
        const list = items.filter((i) => i.status === g.status);
        if (list.length === 0 && g.empty === "") return null;
        return (
          <section key={g.status} className="rx-stack">
            <div className="rx-eyebrow">
              {g.title} · {list.length}
            </div>
            {list.length === 0 ? <p className="rx-mute rx-small">{g.empty}</p> : null}
            {list.map((i) => (
              <article key={i.nominationId} className="rx-plate rx-plate-tight rx-stack rx-check-card">
                <div className="rx-spread">
                  <div className="rx-row" style={{ gap: 10, minWidth: 0 }}>
                    <Ribbon vertical={i.vertical} size="lg" />
                    <div style={{ minWidth: 0 }}>
                      <h3 className="rx-h3" style={{ overflowWrap: "anywhere" }}>{i.chapterName}</h3>
                      <div className="rx-small rx-mute">{i.awardTitle}</div>
                    </div>
                  </div>
                  <Seal tone={i.status === "checked" ? "laurel" : i.status === "submitted" ? "gilt" : i.status === "returned" ? "vermilion" : "mute"}>
                    {NOMINATION_STATUS_LABEL[i.status]}
                  </Seal>
                </div>
                <div className="rx-row rx-small" style={{ gap: 8 }}>
                  {i.nlAdded ? <Seal tone="gilt">Added by National Leadership</Seal> : null}
                  <Seal tone="mute">Region {i.region}</Seal>
                  <Seal tone="laurel">{CATEGORY_LABEL[i.category]}</Seal>
                  {i.submittedAt ? (
                    <span className="rx-mute">
                      {i.nlAdded ? "Filed" : "Submitted"} {formatWhen(i.submittedAt)}
                    </span>
                  ) : null}
                </div>

                {i.status === "submitted" || i.status === "checked" ? (
                  <div className="rx-stack rx-small" style={{ gap: 4 }}>
                    <PassLine seat="Regional Chair" pass={i.rcPass} />
                    <PassLine seat="Regional Mentor" pass={i.rmPass} />
                  </div>
                ) : null}

                {i.returned ? (
                  <div className="rx-notice rx-notice-alert rx-small">
                    <strong>Sent back by {i.returned.by}</strong>
                    {i.returned.at ? ` · ${formatWhen(i.returned.at)}` : ""}
                    <p className="rx-p-quote" style={{ marginTop: 6 }}>{i.returned.note}</p>
                    {i.status === "returned" ? (
                      <p style={{ marginTop: 6 }}>
                        {i.fixBy
                          ? `${i.nlAdded ? "National Leadership" : "The chapter"} can fix it until ${formatWhen(i.fixBy)}.`
                          : `${i.nlAdded ? "National Leadership" : "The chapter"} can fix it.`}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {i.excludedWhy ? <p className="rx-small rx-mute">{i.excludedWhy}</p> : null}

                {i.nlAdded ? <AddedReason a={i.nlAdded} /> : <Dossier d={i.dossier} />}

                {i.status === "submitted" ? (
                  <CheckControls
                    nominationId={i.nominationId}
                    chapterName={i.chapterName}
                    pass={i.pass}
                    canReturn={i.canReturn}
                    returnBlocked={i.returnBlocked}
                    fixClosed={i.nlAdded ? isPast(i.fixBy) : fixClosed}
                    nlAdded={i.nlAdded !== null}
                  />
                ) : null}
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}
