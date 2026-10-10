import { requireRxSuperAdmin } from "@/lib/recognitions/auth";
import { rxService } from "@/lib/recognitions/supabase";
import { getCurrentCycle, getPeople, listChapters } from "@/lib/recognitions/data";
import { REGIONS, RX_APP, RX_ROLES } from "@/lib/recognitions/constants";
import { NoAccess, Notice, PageHead } from "../../../_ui/primitives";
import { GrantRoleForm, RevokeRoleButton } from "./team-forms";

export const metadata = { title: "Team" };

const ROLE_COPY: Record<string, { label: string; what: string }> = {
  [RX_ROLES.superAdmin]: { label: "Recognitions super admin", what: "Runs this control room: timelines, awards, evaluators, citations, reports." },
  [RX_ROLES.nationalLeadership]: { label: "National Leadership", what: "Reads the Stage 1 and Stage 2 summaries; approves an award or sends it back." },
  [RX_ROLES.regionalChair]: { label: "Regional Chair", what: "Checks one region's nominations with a Regional Mentor before they are scored: passes each one or sends it back with a note." },
  [RX_ROLES.chapterRep]: { label: "Chapter representative", what: "Files nominations and predictions for one chapter, alongside its chair." },
};

type Holder = { id: string; person_id: string; role: string; yi_chapter: string | null; yi_zone: string | null; yi_year: number };

export default async function TeamPage() {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return <NoAccess reason={gate.error} />;

  const [cycle, chapters] = await Promise.all([getCurrentCycle(), listChapters()]);
  const { data, error } = await rxService()
    .schema("yi_directory")
    .from("role_assignments")
    .select("id, person_id, role, yi_chapter, yi_zone, yi_year")
    .eq("app", RX_APP)
    .in("role", Object.keys(ROLE_COPY))
    .eq("is_active", true)
    .order("yi_year", { ascending: false });
  const holders = (data ?? []) as Holder[];
  const people = await getPeople(holders.map((h) => h.person_id));
  const year = cycle?.yi_year ?? new Date().getFullYear();

  return (
    <div className="rx-stack-lg">
      <PageHead eyebrow="Control room" title="Team">
        <p className="rx-mute">
          Roles live in the Yi directory, so a person keeps one identity across every Yi app. New roles are recorded for Yi year {year}.
        </p>
      </PageHead>

      <Notice tone="ok">
        Chapter chairs and co-chairs need nothing here: the Yi directory already makes them their chapter&apos;s login. Regional Mentors and the
        NMT are added on the Evaluators page, per award.
      </Notice>

      {error ? <Notice tone="alert">Couldn&apos;t read the current team from the Yi directory. Reload the page.</Notice> : null}

      {Object.entries(ROLE_COPY).map(([role, copy]) => {
        const list = holders
          .filter((h) => h.role === role)
          .sort((a, b) => (people.get(a.person_id)?.full_name ?? "").localeCompare(people.get(b.person_id)?.full_name ?? ""));
        return (
          <section key={role} className="rx-stack">
            <div>
              <h2 className="rx-h2">{copy.label}</h2>
              <p className="rx-small rx-mute">{copy.what}</p>
            </div>
            {list.length === 0 ? (
              <p className="rx-mute rx-small">No one yet.</p>
            ) : (
              <div className="rx-ledger-wrap">
                <table className="rx-ledger">
                  <thead>
                    <tr>
                      <th>Person</th>
                      {role === RX_ROLES.chapterRep ? <th>Chapter</th> : null}
                      {role === RX_ROLES.regionalChair ? <th>Region</th> : null}
                      <th className="rx-num">Yi year</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((h) => {
                      const p = people.get(h.person_id);
                      return (
                        <tr key={h.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{p?.full_name ?? "Unknown person"}</div>
                            <div className="rx-ad-mini">
                              {p?.email ?? "no email"}
                              {p && !p.user_id ? " · No login yet" : ""}
                            </div>
                          </td>
                          {role === RX_ROLES.chapterRep ? <td>{h.yi_chapter ?? "—"}</td> : null}
                          {role === RX_ROLES.regionalChair ? <td className="rx-num">{h.yi_zone ?? "—"}</td> : null}
                          <td className="rx-num">{h.yi_year}</td>
                          <td>
                            {h.person_id === gate.viewer.personId && role === RX_ROLES.superAdmin ? (
                              <span className="rx-ad-mini">You</span>
                            ) : (
                              <RevokeRoleButton assignmentId={h.id} who={p?.full_name ?? "this person"} roleLabel={copy.label} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      <section className="rx-plate rx-stack">
        <h2 className="rx-h2">Give someone a role</h2>
        <GrantRoleForm
          roles={Object.entries(ROLE_COPY).map(([value, c]) => ({ value, label: c.label }))}
          chapters={chapters.map((c) => ({ id: c.id, name: c.name }))}
          regions={[...REGIONS]}
        />
      </section>
    </div>
  );
}
