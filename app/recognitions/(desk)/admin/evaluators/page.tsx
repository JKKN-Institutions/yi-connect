import Link from "next/link";
import { requireRxSuperAdmin } from "@/lib/recognitions/auth";
import { conflictsForDuties, getCurrentCycle, getPeople, listAwards, listChapters, listEvaluators } from "@/lib/recognitions/data";
import { LAYER_LABEL } from "@/lib/recognitions/constants";
import { Ribbon } from "../../../_ui/ribbon";
import { NoAccess, PageHead, Seal } from "../../../_ui/primitives";
import { AssignEvaluatorForm, DutyActions } from "./evaluator-forms";

export const metadata = { title: "Evaluators" };

export default async function EvaluatorsPage({ searchParams }: { searchParams: Promise<{ award?: string }> }) {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return <NoAccess reason={gate.error} />;
  const cycle = await getCurrentCycle();
  const awards = cycle ? await listAwards(cycle.id) : [];
  if (!cycle || awards.length === 0) {
    return (
      <div className="rx-stack-lg">
        <PageHead eyebrow="Control room" title="Evaluators" />
        <div className="rx-plate rx-stack">
          <p>{cycle ? "Add the awards first; evaluators are assigned per award." : "Open a cycle first."}</p>
          <div>
            <Link className="rx-btn" href={cycle ? "/recognitions/admin/awards" : "/recognitions/admin/timeline"}>
              {cycle ? "Go to Awards" : "Go to Timeline"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { award: awardParam } = await searchParams;
  const award = awards.find((a) => a.id === awardParam) ?? awards[0];
  const [duties, chapters] = await Promise.all([listEvaluators(award.id), listChapters()]);
  const [people, conflicts] = await Promise.all([getPeople(duties.map((d) => d.person_id)), conflictsForDuties(duties)]);
  const chapterName = new Map(chapters.map((c) => [c.id, c.name]));
  const sorted = [...duties].sort((a, b) =>
    a.layer === b.layer ? (a.region ?? "").localeCompare(b.region ?? "") : a.layer === "rm" ? -1 : 1
  );

  return (
    <div className="rx-stack-lg">
      <PageHead eyebrow={`Control room · ${cycle.name}`} title="Evaluators">
        <p className="rx-mute">
          Regional Mentors score their own region&apos;s nominations; the NMT scores every nomination for the award. Nobody scores a chapter
          they are linked to. People are found by their Yi directory email.
        </p>
      </PageHead>

      <nav className="rx-ad-chips" aria-label="Awards">
        {awards.map((a) => (
          <Link
            key={a.id}
            href={`/recognitions/admin/evaluators?award=${a.id}`}
            className="rx-ad-chip"
            aria-current={a.id === award.id ? "page" : undefined}
          >
            <Ribbon vertical={a.vertical} /> {a.title}
          </Link>
        ))}
      </nav>

      <section className="rx-stack">
        <h2 className="rx-h2">{award.title}: who scores it</h2>
        {sorted.length === 0 ? (
          <p className="rx-mute">No evaluators yet. Assign the Regional Mentors and the NMT below.</p>
        ) : (
          <div className="rx-ledger-wrap">
            <table className="rx-ledger">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Duty</th>
                  <th>Won&apos;t see</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((d) => {
                  const p = people.get(d.person_id);
                  const declared = new Set(d.conflict_chapter_ids ?? []);
                  const auto = [...(conflicts.get(d.id) ?? [])].filter((id) => !declared.has(id));
                  return (
                    <tr key={d.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p?.full_name ?? "Unknown person"}</div>
                        <div className="rx-ad-mini">{p?.email ?? "no email"}</div>
                        {p && !p.user_id ? <div className="rx-ad-mini" style={{ color: "var(--rx-vermilion)" }}>No login yet</div> : null}
                      </td>
                      <td>
                        <div>{LAYER_LABEL[d.layer]}</div>
                        <div className="rx-row" style={{ gap: 6, marginTop: 4 }}>
                          {d.region ? <Seal tone="mute">{d.region}</Seal> : null}
                          {d.is_nmt_leader ? <Seal tone="gilt">NMT leader</Seal> : null}
                        </div>
                      </td>
                      <td className="rx-small" style={{ minWidth: 200 }}>
                        {auto.length === 0 && declared.size === 0 ? <span className="rx-mute">No conflicts</span> : null}
                        {auto.map((id) => (
                          <div key={`a-${id}`}>Linked to {chapterName.get(id) ?? "a chapter"} — won&apos;t see it</div>
                        ))}
                        {[...declared].map((id) => (
                          <div key={`d-${id}`}>Declared: {chapterName.get(id) ?? "a chapter"}</div>
                        ))}
                      </td>
                      <td>
                        <DutyActions
                          evaluatorId={d.id}
                          personName={p?.full_name ?? "this person"}
                          declared={[...declared]}
                          chapters={chapters.map((c) => ({ id: c.id, name: c.name }))}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rx-plate rx-stack">
        <h2 className="rx-h2">Assign an evaluator to {award.title}</h2>
        <AssignEvaluatorForm
          awardId={award.id}
          hasLeader={duties.some((d) => d.is_nmt_leader)}
          chapters={chapters.map((c) => ({ id: c.id, name: c.name }))}
        />
      </section>
    </div>
  );
}
