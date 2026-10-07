import Link from "next/link";
import { requireRxSuperAdmin } from "@/lib/recognitions/auth";
import {
  chapterMap,
  effectiveText,
  getAwardState,
  getCurrentCycle,
  getPeople,
  listAwards,
  listCitationEdits,
} from "@/lib/recognitions/data";
import { CATEGORIES, CATEGORY_LABEL, RANK_LABEL } from "@/lib/recognitions/constants";
import { Ribbon } from "../../../_ui/ribbon";
import { NoAccess, Notice, PageHead, PhaseSeal, formatWhen } from "../../../_ui/primitives";
import { PolishForm, ScriptForm } from "./citation-forms";

export const metadata = { title: "Citations" };

const FIELD_LABEL = { citation: "Citation", announcement: "Announcement text", ceremony_script: "Ceremony script" } as const;

export default async function CitationsPage({ searchParams }: { searchParams: Promise<{ award?: string }> }) {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return <NoAccess reason={gate.error} />;
  const cycle = await getCurrentCycle();
  const awards = cycle ? await listAwards(cycle.id) : [];
  if (!cycle || awards.length === 0) {
    return (
      <div className="rx-stack-lg">
        <PageHead eyebrow="Control room" title="Citations" />
        <div className="rx-plate"><p>Nothing to polish yet. Citations appear here once an NMT leader submits a moderation.</p></div>
      </div>
    );
  }

  const states = (await Promise.all(awards.map((a) => getAwardState(a.id)))).filter((s) => s !== null);
  const ready = states.filter((s) => s.latestSubmittedVersion);
  const { award: awardParam } = await searchParams;
  const st = ready.find((s) => s.award.id === awardParam) ?? ready[0] ?? null;

  if (!st || !st.latestSubmittedVersion) {
    return (
      <div className="rx-stack-lg">
        <PageHead eyebrow={`Control room · ${cycle.name}`} title="Citations" />
        <div className="rx-plate">
          <p>No award has a submitted moderation yet. Once an NMT leader submits the top 3, the citations and announcement text appear here to polish.</p>
        </div>
      </div>
    );
  }

  const version = st.latestSubmittedVersion;
  const [edits, chapters] = await Promise.all([listCitationEdits(st.award.id), chapterMap()]);
  const editors = await getPeople(edits.map((e) => e.edited_by));
  const noms = new Map(st.nominations.map((n) => [n.id, n]));
  const versionNo = new Map(st.versions.map((v) => [v.id, v.version]));
  const places = CATEGORIES.flatMap((category) =>
    ([1, 2, 3] as const)
      .map((rank) => ({ category, rank, entry: version.top3.find((t) => t.category === category && t.rank === rank) }))
      .filter((p) => p.entry)
  );
  const script = edits.filter((e) => e.field === "ceremony_script")[0] ?? null;

  return (
    <div className="rx-stack-lg">
      <PageHead eyebrow={`Control room · ${cycle.name}`} title="Citations and script">
        <p className="rx-mute">
          Polish the words read out at the ceremony. Rankings can&apos;t be changed here. Every save is kept; the newest version is the one used.
        </p>
      </PageHead>

      <nav className="rx-ad-chips" aria-label="Awards">
        {ready.map((s) => (
          <Link
            key={s.award.id}
            href={`/recognitions/admin/citations?award=${s.award.id}`}
            className="rx-ad-chip"
            aria-current={s.award.id === st.award.id ? "page" : undefined}
          >
            <Ribbon vertical={s.award.vertical} /> {s.award.title}
          </Link>
        ))}
      </nav>
      {states.length > ready.length ? (
        <p className="rx-small rx-mute">
          Not ready yet: {states.filter((s) => !s.latestSubmittedVersion).map((s) => s.award.title).join(", ")}.
        </p>
      ) : null}

      <div className="rx-spread">
        <h2 className="rx-h2">{st.award.title}</h2>
        <PhaseSeal phase={st.phase} />
      </div>
      <p className="rx-small rx-mute">
        Polishing moderation version {version.version}, submitted {formatWhen(version.submitted_at)}.
        {st.phase === "reevaluation" ? " A re-evaluation is under way; text polished now stays with this version only." : ""}
      </p>
      {st.phase === "reevaluation" ? (
        <Notice>National Leadership sent this award back. If the NMT leader changes the podium, polish the new version once it is submitted.</Notice>
      ) : null}

      <div className="rx-podium">
        {places.map(({ category, rank, entry }) => {
          const nom = entry ? noms.get(entry.nomination_id) : undefined;
          const chapter = nom ? chapters.get(nom.chapter_id)?.name ?? "Chapter not found" : "Chapter not found";
          const modCitation = entry?.citation ?? "";
          const draft = nom?.announcement_draft ?? "";
          return (
            <section key={`${category}-${rank}`} className="rx-plate rx-place rx-stack" data-rank={rank}>
              <div>
                <div className="rx-eyebrow">
                  {CATEGORY_LABEL[category]} · {RANK_LABEL[rank]}
                </div>
                <h3 className="rx-h2" style={{ marginTop: 4 }}>{chapter}</h3>
              </div>
              <PolishForm
                awardId={st.award.id}
                category={category}
                rank={rank}
                field="citation"
                original={modCitation}
                originalLabel="NMT leader's citation"
                current={effectiveText(edits, version.id, "citation", category, rank, modCitation)}
              />
              <PolishForm
                awardId={st.award.id}
                category={category}
                rank={rank}
                field="announcement"
                original={draft}
                originalLabel="Chapter's own announcement draft"
                current={effectiveText(edits, version.id, "announcement", category, rank, draft)}
              />
            </section>
          );
        })}
        {places.length === 0 ? <p className="rx-mute">This moderation has no podium places.</p> : null}
      </div>

      <section className="rx-plate rx-stack">
        <h2 className="rx-h2">Ceremony script</h2>
        <ScriptForm awardId={st.award.id} current={script?.body ?? ""} />
      </section>

      <section className="rx-stack">
        <h2 className="rx-h2">Edit history</h2>
        {edits.length === 0 ? (
          <p className="rx-mute rx-small">No edits yet.</p>
        ) : (
          <div className="rx-ledger-wrap">
            <table className="rx-ledger">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>What</th>
                  <th>Text</th>
                </tr>
              </thead>
              <tbody>
                {edits.map((e) => (
                  <tr key={e.id}>
                    <td className="rx-small rx-num" style={{ whiteSpace: "nowrap" }}>{formatWhen(e.edited_at)}</td>
                    <td className="rx-small">{editors.get(e.edited_by)?.full_name ?? "Unknown"}</td>
                    <td className="rx-small">
                      {FIELD_LABEL[e.field]}
                      {e.category && e.rank ? ` · ${CATEGORY_LABEL[e.category]} ${RANK_LABEL[e.rank as 1 | 2 | 3].toLowerCase()}` : ""}
                      {e.moderation_version_id ? <div className="rx-ad-mini">on version {versionNo.get(e.moderation_version_id) ?? "?"}</div> : null}
                    </td>
                    <td className="rx-small rx-ad-pre" style={{ minWidth: 260 }}>{e.body}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
