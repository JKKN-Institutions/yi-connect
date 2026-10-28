import Link from "next/link";
import { requireRxOversight } from "@/lib/recognitions/auth";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/recognitions/constants";
import { stageSheet } from "@/app/api/recognitions/reports/_lib/stage-sheet";
import { IconDownload } from "../../../_ui/icons";
import { NoAccess, Notice, PageHead } from "../../../_ui/primitives";
import { PrintButton } from "./print-button";
import "./stage-sheet.css";

export const metadata = { title: "Stage sheet" };

/**
 * The stage sheet (recognitions_05, Piyush 15 Oct 2026): every recognition
 * and category with its final 1st, 2nd and 3rd chapters and the NMT's
 * citation, laid out to be read out on stage. CSV download + print view.
 * Control room page, also open to National Leadership.
 */
export default async function StageSheetPage({ searchParams }: { searchParams: Promise<{ include?: string }> }) {
  const gate = await requireRxOversight();
  if (!gate.ok) return <NoAccess reason={gate.error} />;
  const includePending = (await searchParams).include === "pending";
  const sheet = await stageSheet(includePending);
  if (!sheet) {
    return (
      <div className="rx-stack-lg">
        <PageHead eyebrow="Control room" title="Stage sheet" />
        <div className="rx-plate"><p>No cycle is open yet, so there is nothing to put on the stage sheet.</p></div>
      </div>
    );
  }
  const csvHref = `/api/recognitions/reports/stage-sheet${includePending ? "?include=pending" : ""}`;

  return (
    <div className="rx-stack-lg">
      <PageHead eyebrow={`${sheet.cycle.name} · read out on stage`} title="Stage sheet">
        <p className="rx-mute rx-stage-tools">
          For every recognition and category: the 3 finalists, with the NMT&apos;s citation
          (and the super admin&apos;s polish, where there is one).
        </p>
      </PageHead>

      <div className="rx-row rx-stage-tools" style={{ gap: 8 }}>
        <a className="rx-btn rx-btn-gilt" href={csvHref} data-testid="stage-sheet-csv">
          <IconDownload size={16} /> Download CSV
        </a>
        <PrintButton />
        {includePending ? (
          <Link href="/recognitions/admin/stage-sheet" className="rx-link rx-small">Show approved recognitions only</Link>
        ) : (
          <Link href="/recognitions/admin/stage-sheet?include=pending" className="rx-link rx-small">
            Also show recognitions awaiting National Leadership (rehearsal copy)
          </Link>
        )}
      </div>

      {sheet.awards.length === 0 ? (
        <div className="rx-plate">
          <p>No recognition is ready for the stage yet. A recognition appears here once National Leadership approves it.</p>
        </div>
      ) : null}

      {sheet.awards.map((a) => (
        <section key={a.title} className="rx-plate rx-stack rx-stage-award" data-testid="stage-award">
          <div className="rx-spread">
            <h2 className="rx-h1" style={{ fontSize: "1.6rem" }}>{a.title}</h2>
            {!a.approved ? <span className="rx-seal rx-seal-vermilion">Not yet approved</span> : null}
          </div>
          {CATEGORIES.map((category) => {
            const places = a.places.filter((p) => p.category === category).sort((x, y) => x.rank - y.rank);
            if (places.length === 0) return null;
            return (
              <div key={category} className="rx-stack rx-stage-cat">
                <h3 className="rx-h2">{CATEGORY_LABEL[category]}</h3>
                {places.map((p) => (
                  <article key={p.rank} className="rx-stage-place" data-rank={p.rank}>
                    <div className="rx-eyebrow">{p.rankLabel}</div>
                    <div className="rx-stage-chapter">
                      {p.chapterName}
                      {p.region ? <span className="rx-small rx-mute"> · {p.region}</span> : null}
                    </div>
                    {p.homeOf ? <div className="rx-small rx-home-note">Home chapter of {p.homeOf}</div> : null}
                    <p className="rx-stage-citation">{p.citation.trim() || "No citation written."}</p>
                    {p.rationale.trim() ? (
                      <p className="rx-small rx-mute rx-stage-why">
                        <strong>NMT&apos;s reasoning:</strong> {p.rationale}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            );
          })}
        </section>
      ))}

      {sheet.notIncluded.length > 0 ? (
        <Notice>
          <span className="rx-small">
            Not on this sheet yet: {sheet.notIncluded.map((n) => `${n.title} (${n.why})`).join(", ")}.
          </span>
        </Notice>
      ) : null}
    </div>
  );
}
