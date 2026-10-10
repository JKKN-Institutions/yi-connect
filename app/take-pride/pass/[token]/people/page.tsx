import type { Metadata } from "next";
import Link from "next/link";
import { TopBar, SampleNote, Denied } from "../../../_ui";
import { TP_ZONES } from "@/lib/take-pride/constants";
import { YI_VERTICALS } from "@/lib/take-pride/profile";
import {
  SEARCH_MAX,
  chapterTwins,
  filterDirectory,
  fitLine,
  getDelegateProfileByToken,
  getDirectoryPeople,
  hasFilters,
  parseDirectoryFilters,
  type DirectoryPerson,
} from "@/lib/take-pride/directory";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Delegate directory" };

/** Cards drawn at once; search or filter to narrow a long list. */
const SHOW_MAX = 60;

function MeetLink({ token, person }: { token: string; person: Pick<DirectoryPerson, "id" | "delegate_meetings_opt_in"> }) {
  if (!person.delegate_meetings_opt_in) {
    return <span className="tp-small" data-tp="no-meet">Not taking meeting requests</span>;
  }
  return (
    <Link href={`/take-pride/pass/${token}/meet?to=${person.id}`} className="tp-btn ghost sm" data-tp="ask-meet">
      Ask to meet
    </Link>
  );
}

function PersonCard({ token, p, fit }: { token: string; p: DirectoryPerson; fit: string }) {
  const work = [p.role_title, p.business_name].filter(Boolean).join(" · ");
  return (
    <article className="tp-stack" style={{ gap: 6 }} data-tp="person" data-name={p.full_name}>
      <div className="tp-row" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <h3 className="tp-h3">{p.full_name}</h3>
          {work && <p style={{ margin: 0 }}>{work}</p>}
          <p className="tp-small" style={{ margin: 0 }}>
            {p.chapter} · {p.zone} · {p.industry}
          </p>
        </div>
        {p.yi_vertical && <span className="tp-tag" style={{ flex: "none" }}>{p.yi_vertical}</span>}
      </div>
      {p.working_on && (
        <p style={{ margin: 0 }}>
          <b>Working on:</b> {p.working_on}
        </p>
      )}
      {p.ask_me_about && (
        <p style={{ margin: 0 }}>
          <b>Ask me about:</b> {p.ask_me_about}
        </p>
      )}
      {p.pledge && (
        <p className="tp-small" style={{ margin: 0 }}>
          <b>My 1% pledge:</b> {p.pledge}
        </p>
      )}
      {fit && (
        <p className="tp-small" style={{ margin: 0 }} data-tp="fit">
          {fit}
        </p>
      )}
      <div>
        <MeetLink token={token} person={p} />
      </div>
    </article>
  );
}

export default async function PeoplePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const me = await getDelegateProfileByToken(token);
  if (!me) {
    return <Denied title="Pass not found" text="This pass link is not valid. Ask the Take Pride desk for your link." />;
  }

  const people = await getDirectoryPeople(me);
  const industries = [...new Set(people.map((p) => p.industry))].sort();
  const f = parseDirectoryFilters(await searchParams, industries);
  const filtering = hasFilters(f);
  const found = filterDirectory(people, me, f);
  const shown = found.slice(0, SHOW_MAX);
  const twins = chapterTwins(people, me);
  const base = `/take-pride/pass/${token}/people`;
  const noTags = me.needs.length === 0 && me.offers.length === 0;

  return (
    <main className="tp-main">
      <TopBar right={<Link href={`/take-pride/pass/${token}`} className="tp-btn ghost sm">My pass</Link>} />
      {me.is_sample && <SampleNote>Sample delegates for the demo. The real list replaces them before the event.</SampleNote>}

      <header className="tp-stack" style={{ gap: 6 }}>
        <p className="tp-eyebrow" style={{ margin: 0 }}>Networking</p>
        <h1 className="tp-h2">Delegate directory</h1>
        <p className="tp-mute" style={{ margin: 0 }}>
          Delegates who chose to be listed. Phone numbers and emails are never shown here.
        </p>
      </header>

      {!me.directory_visible && (
        <p className="tp-alert warn" style={{ margin: 0 }} data-tp="not-listed">
          You are not listed yet, so others cannot find you here. You can still browse.{" "}
          <Link href={`/take-pride/pass/${token}/profile`}>List me in the directory</Link>
        </p>
      )}

      {/* Search + filters: a plain GET form, so it works without JavaScript and the URL keeps the filters. */}
      <form method="get" action={base} className="tp-card" role="search" aria-label="Search the directory" data-tp="filters">
        <div className="tp-field">
          <label htmlFor="tp-q">Search</label>
          <input
            id="tp-q"
            name="q"
            type="search"
            className="tp-input"
            defaultValue={f.q}
            maxLength={SEARCH_MAX}
            placeholder="Name, chapter, business or what they work on"
            data-tp="q"
          />
        </div>
        <div className="tp-grid2">
          <div className="tp-field">
            <label htmlFor="tp-zone">Zone</label>
            <select id="tp-zone" name="zone" className="tp-select" defaultValue={f.zone} data-tp="zone">
              <option value="">All zones</option>
              {TP_ZONES.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </div>
          <div className="tp-field">
            <label htmlFor="tp-industry">Industry</label>
            <select id="tp-industry" name="industry" className="tp-select" defaultValue={f.industry} data-tp="industry">
              <option value="">All industries</option>
              {industries.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="tp-field">
          <label htmlFor="tp-vertical">Yi vertical</label>
          <select id="tp-vertical" name="vertical" className="tp-select" defaultValue={f.vertical} data-tp="vertical">
            <option value="">All verticals</option>
            {YI_VERTICALS.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
        <fieldset className="tp-stack" style={{ gap: 8, border: 0, padding: 0, margin: 0 }}>
          <legend className="tp-legend">Show only people who</legend>
          <label style={{ display: "flex", gap: 10, alignItems: "center", minHeight: 36 }}>
            <input type="checkbox" name="theyneed" value="1" defaultChecked={f.theyNeed} data-tp="theyneed" />
            Need what I offer
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "center", minHeight: 36 }}>
            <input type="checkbox" name="theyoffer" value="1" defaultChecked={f.theyOffer} data-tp="theyoffer" />
            Offer what I need
          </label>
          {noTags && (
            <p className="tp-small" style={{ margin: 0 }}>
              These two work once you pick what you need and offer in{" "}
              <Link href={`/take-pride/pass/${token}/profile`}>your profile</Link>.
            </p>
          )}
        </fieldset>
        <div className="tp-row" style={{ justifyContent: "flex-start" }}>
          <button type="submit" className="tp-btn saffron sm" data-tp="apply">
            Show delegates
          </button>
          {filtering && (
            <Link href={base} className="tp-btn ghost sm" data-tp="clear">
              Clear
            </Link>
          )}
        </div>
      </form>

      {/* Chapter twins */}
      <details className="tp-card" open={!filtering} data-tp="twins">
        <summary className="tp-h2" style={{ cursor: "pointer" }}>Chapter twins</summary>
        {me.chapter_wants.length === 0 ? (
          <p className="tp-mute" style={{ margin: 0 }} data-tp="twins-empty">
            Tell us what your chapter wants help with, and we will show chapters that do it well.{" "}
            <Link href={`/take-pride/pass/${token}/profile`}>Edit my profile</Link>
          </p>
        ) : twins.length === 0 ? (
          <p className="tp-mute" style={{ margin: 0 }} data-tp="twins-empty">
            No listed chapter does {me.chapter_wants.join(", ")} well yet. Check again as more delegates join.
          </p>
        ) : (
          <>
            <p className="tp-small" style={{ margin: 0 }}>
              Chapters that do well what {me.chapter} wants help with: {me.chapter_wants.join(", ")}.
            </p>
            <div className="tp-list">
              {twins.map((t) => (
                <article key={t.chapter} className="tp-stack" style={{ gap: 6 }} data-tp="twin" data-chapter={t.chapter}>
                  <div className="tp-row" style={{ alignItems: "flex-start" }}>
                    <h3 className="tp-h3">{t.chapter}</h3>
                    <span className="tp-small">{t.zone}</span>
                  </div>
                  <div className="tp-chips">
                    {t.matched.map((m) => (
                      <span key={m} className="tp-chip on">{m}</span>
                    ))}
                  </div>
                  <ul className="tp-stack" style={{ gap: 6, margin: 0, padding: 0, listStyle: "none" }}>
                    {t.people.map((p) => (
                      <li key={p.id} className="tp-row" data-tp="twin-person">
                        <span style={{ minWidth: 0 }}>
                          {p.full_name}
                          {p.role_title && <span className="tp-small"> · {p.role_title}</span>}
                        </span>
                        <MeetLink token={token} person={p} />
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </>
        )}
      </details>

      {/* Results */}
      <section className="tp-card" aria-labelledby="tp-results" data-tp="results">
        <div className="tp-row">
          <h2 className="tp-h2" id="tp-results">{filtering ? "Matching delegates" : "All listed delegates"}</h2>
          <span className="tp-small tp-num" data-tp="count">{found.length}</span>
        </div>
        {people.length === 0 ? (
          <p className="tp-mute" style={{ margin: 0 }}>No one is listed yet. Check again closer to the event.</p>
        ) : found.length === 0 ? (
          <p className="tp-mute" style={{ margin: 0 }} data-tp="none">
            No one matches. Try fewer filters or <Link href={base}>clear them</Link>.
          </p>
        ) : (
          <div className="tp-list">
            {shown.map((p) => (
              <PersonCard key={p.id} token={token} p={p} fit={fitLine(p, me)} />
            ))}
          </div>
        )}
        {found.length > shown.length && (
          <p className="tp-small" style={{ margin: 0 }}>
            Showing the first {shown.length} of {found.length}. Search or filter to narrow the list.
          </p>
        )}
      </section>
    </main>
  );
}
