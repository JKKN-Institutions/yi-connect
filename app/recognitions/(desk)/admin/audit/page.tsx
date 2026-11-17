import { requireRxSuperAdmin } from "@/lib/recognitions/auth";
import { chapterMap, getCurrentCycle, listAwards, listChapters } from "@/lib/recognitions/data";
import { auditLookups, loadCycleAudit } from "@/lib/recognitions/audit-data";
import {
  actionText,
  actorName,
  auditQuery,
  chaptersOf,
  detailText,
  filterAuditRows,
  isFiltered,
  parseAuditFilter,
  readableDetail,
  words,
} from "@/lib/recognitions/audit-log";
import { IconDownload } from "../../../_ui/icons";
import { NoAccess, PageHead, formatWhen } from "../../../_ui/primitives";

export const metadata = { title: "Audit trail" };

const PAGE_SIZE = 100;
const cellStyle = { minWidth: 0 } as const;

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return <NoAccess reason={gate.error} />;
  const cycle = await getCurrentCycle();
  if (!cycle) {
    return (
      <div className="rx-stack-lg">
        <PageHead eyebrow="Control room" title="Audit trail" />
        <div className="rx-plate"><p>Open a cycle first; the audit trail is kept per cycle.</p></div>
      </div>
    );
  }

  const sp = await searchParams;
  const filter = parseAuditFilter(sp);
  const all = await loadCycleAudit(cycle.id);
  const [look, awards, chapters, chapterList] = await Promise.all([
    auditLookups(all),
    listAwards(cycle.id, true),
    chapterMap(),
    listChapters(),
  ]);
  const rows = filterAuditRows(all, filter, look);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageNo = Math.min(pages, Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1));
  const shown = rows.slice((pageNo - 1) * PAGE_SIZE, pageNo * PAGE_SIZE);
  const awardTitle = new Map(awards.map((a) => [a.id, a.title]));
  const chapterName = new Map([...chapters].map(([id, c]) => [id.toLowerCase(), c.name]));

  // Dropdown choices come from what is actually in this cycle's log.
  const actionCount = new Map<string, number>();
  for (const r of all) actionCount.set(r.action, (actionCount.get(r.action) ?? 0) + 1);
  const actions = [...actionCount].sort((a, b) => b[1] - a[1]);
  const actorNames = [...new Set(all.map((r) => actorName(r, look.personName)))].sort((a, b) => a.localeCompare(b));
  const filtered = isFiltered(filter);
  const first = rows.length === 0 ? 0 : (pageNo - 1) * PAGE_SIZE + 1;
  const last = (pageNo - 1) * PAGE_SIZE + shown.length;

  return (
    <div className="rx-stack-lg">
      <PageHead eyebrow={`Control room · ${cycle.name}`} title="Audit trail">
        <p className="rx-mute">
          Every action in this cycle since {all.length ? formatWhen(all[all.length - 1].at) : "it opened"}, newest first. Nothing here can be edited or deleted.
        </p>
      </PageHead>

      <form method="get" className="rx-plate rx-stack" style={{ minWidth: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 12 }}>
          <div style={cellStyle}>
            <label className="rx-label" htmlFor="audit-who">Person</label>
            <input id="audit-who" name="who" className="rx-input" list="audit-people" defaultValue={filter.who} placeholder="Part of a name" autoComplete="off" />
            <datalist id="audit-people">
              {actorNames.map((n) => <option key={n} value={n} />)}
            </datalist>
          </div>
          <div style={cellStyle}>
            <label className="rx-label" htmlFor="audit-chapter">Chapter</label>
            <select id="audit-chapter" name="chapter" className="rx-select" defaultValue={filter.chapter}>
              <option value="">All chapters</option>
              {chapterList.map((c) => <option key={c.id} value={c.id.toLowerCase()}>{c.name}</option>)}
            </select>
          </div>
          <div style={cellStyle}>
            <label className="rx-label" htmlFor="audit-award">Recognition</label>
            <select id="audit-award" name="award" className="rx-select" defaultValue={filter.award}>
              <option value="">All recognitions</option>
              {awards.map((a) => <option key={a.id} value={a.id.toLowerCase()}>{a.title}</option>)}
            </select>
          </div>
          <div style={cellStyle}>
            <label className="rx-label" htmlFor="audit-action">Action</label>
            <select id="audit-action" name="action" className="rx-select" defaultValue={filter.action}>
              <option value="">All actions</option>
              {actions.map(([a, n]) => <option key={a} value={a}>{words(a)} ({n})</option>)}
            </select>
          </div>
          <div style={cellStyle}>
            <label className="rx-label" htmlFor="audit-from">From (IST)</label>
            <input id="audit-from" name="from" type="date" className="rx-input" defaultValue={filter.from} />
          </div>
          <div style={cellStyle}>
            <label className="rx-label" htmlFor="audit-to">To (IST, inclusive)</label>
            <input id="audit-to" name="to" type="date" className="rx-input" defaultValue={filter.to} />
          </div>
        </div>
        <div className="rx-row">
          <button type="submit" className="rx-btn">Show</button>
          {filtered ? <a className="rx-btn rx-btn-quiet" href="/recognitions/admin/audit">Clear filters</a> : null}
        </div>
      </form>

      <div className="rx-row" style={{ justifyContent: "space-between" }}>
        <p className="rx-small" style={{ margin: 0 }}>
          {rows.length === 0
            ? "No actions match."
            : `Showing ${first.toLocaleString("en-IN")}–${last.toLocaleString("en-IN")} of ${rows.length.toLocaleString("en-IN")} ${filtered ? "matching actions" : "actions"}${filtered ? ` (${all.length.toLocaleString("en-IN")} in the cycle)` : ""}.`}
        </p>
        <div className="rx-row" style={{ gap: 8 }}>
          {/* Plain links: the route returns a file, or a JSON error if access is refused. */}
          <a className="rx-btn rx-btn-quiet rx-btn-sm" href={`/api/recognitions/reports/audit${auditQuery(filter, { format: "xlsx" })}`}>
            <IconDownload size={16} /> Download all (Excel)
          </a>
          <a className="rx-btn rx-btn-quiet rx-btn-sm" href={`/api/recognitions/reports/audit${auditQuery(filter, { format: "csv" })}`}>
            <IconDownload size={16} /> CSV
          </a>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rx-plate">
          <p>{all.length === 0 ? "No actions recorded yet. Every change made in Recognitions will appear here." : "Nothing matches these filters. Try a wider date range or clear a filter."}</p>
        </div>
      ) : (
        <div className="rx-ledger-wrap">
          <table className="rx-ledger">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>What</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const chapter = chaptersOf(r, look.nominationChapter).map((c) => chapterName.get(c) ?? "Chapter not found").join(", ");
                const about = [r.award_id ? awardTitle.get(r.award_id) ?? "a recognition" : "", chapter].filter(Boolean).join(" · ");
                return (
                  <tr key={r.id}>
                    <td className="rx-small rx-num" style={{ whiteSpace: "nowrap" }}>{formatWhen(r.at)}</td>
                    <td className="rx-small">{actorName(r, look.personName)}</td>
                    <td className="rx-small">
                      {actionText(r)}
                      {about ? <div className="rx-ad-mini">{about}</div> : null}
                    </td>
                    <td className="rx-small rx-ad-pre" style={{ minWidth: 240 }}>{detailText(readableDetail(r.detail, { ...look, chapterName }), { maxParts: 6, maxChars: 160, skip: ["chapter_id"] })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <nav className="rx-row" aria-label="Pages" style={{ justifyContent: "space-between" }}>
          {pageNo > 1 ? (
            <a className="rx-btn rx-btn-quiet rx-btn-sm" href={`/recognitions/admin/audit${auditQuery(filter, { page: String(pageNo - 1) })}`}>Newer</a>
          ) : <span />}
          <span className="rx-small rx-mute">Page {pageNo} of {pages}</span>
          {pageNo < pages ? (
            <a className="rx-btn rx-btn-quiet rx-btn-sm" href={`/recognitions/admin/audit${auditQuery(filter, { page: String(pageNo + 1) })}`}>Older</a>
          ) : <span />}
        </nav>
      ) : null}
    </div>
  );
}
