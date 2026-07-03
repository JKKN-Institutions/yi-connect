/**
 * FeedbackReportBody — the rendered feedback report, shared by the organizer
 * page (/feedback/report) and the public share link (/yip/r/[token]).
 *
 * Pure presentation from already-fetched data. Anonymization is done at the
 * DATA layer, not here: the public share fetch nulls respondent_name/email
 * before the rows ever reach this component, so a null name simply renders as
 * "Participant". Names can never leak to the public page.
 *
 * The container carries id="yip-report" so the Chapter Round Report's
 * report-print.css prints ONLY the report when Print / Save as PDF is used.
 */
import type { FeedbackResponseRow } from "@/lib/yip/feedback";
import type { FeedbackStats } from "@/app/yip/actions/feedback";
import { PrintButton } from "../../report/PrintButton";

// ── Palette (literal hex — YIP brand tokens are dead) ──
const INK = "#20241B";
const INK2 = "#57584C";
const INK3 = "#8A8878";
const PAPER = "#FBF9F4";
const CARD = "#FFFFFF";
const RULE = "#E5E0D2";
const SAFFRON = "#C96F1B";
const SAFFRON_SOFT = "#F3E2CC";
const GREEN = "#2E7D46";
const AMBER = "#B08A2E";
const RED = "#B3452F";
const SERIF = "Georgia, 'Times New Roman', serif";

type Bucket = { key: string; title: string; hint: string; re: RegExp };

const IMPROVE_BUCKETS: Bucket[] = [
  { key: "speaking", title: "Equal chance to speak & time-keeping", hint: "Turns, timings, “didn’t get to speak”, fairness", re: /chance|opportunit|speak|timing|time manage?ment|equal|didn.?t get/i },
  { key: "extend", title: "Extend the event", hint: "More days or longer sessions", re: /extend|more days|3 days|longer|duration|keeping it for more/i },
  { key: "ai", title: "AI & device usage", hint: "AI-written questions/speeches, mobiles on the floor", re: /\bai\b|chat ?gpt|mobile|phone/i },
  { key: "prep", title: "Advance preparation", hint: "Role briefs & procedures shared before event day", re: /prepar|prior in/i },
  { key: "food", title: "Food & refreshments", hint: "Menu and refreshment quality", re: /food|menu|refresh/i },
  { key: "venue", title: "Venue comfort", hint: "AC / temperature / seating", re: /\bac\b|cooling|temperature|seated|seating/i },
];

const WORKED_BUCKETS: Bucket[] = [
  { key: "parliament", title: "How Parliament actually works", hint: "Procedure, bills, debate, decorum, MP roles", re: /parliament|\bmp\b|bill|speaker|minister|democra|procedur|decorum|constitution|debat|question hour|zero hour|politic/i },
  { key: "confidence", title: "Confidence & public speaking", hint: "“Speak boldly” is the most repeated phrase", re: /confiden|bold|speak|shyness|voice/i },
  { key: "teamwork", title: "Teamwork & collaboration", hint: "Party & committee work, negotiation, new friends", re: /team|collab|together|friend|negotiat|coordinat|cooperat/i },
  { key: "civic", title: "Civic responsibility", hint: "Citizenship, service, the value of one’s voice", re: /citizen|civic|nation|responsib|service|society/i },
  { key: "opportunity", title: "Seizing opportunity", hint: "“Grab the chance — or create it”", re: /grab|opportunit|chance/i },
];

const RECOMMENDATIONS: Record<string, { title: string; body: string }> = {
  speaking: { title: "Guarantee every MP one speaking slot — and track it live.", body: "Use the platform’s speech tracker (done/pending per student) as the Speaker’s call list: no second turns in Question Hour or Zero Hour until every raised placard has had a first. Brief marshals that first-time speakers outrank repeat interventions." },
  extend: { title: "Re-cut the agenda before adding a day.", body: "Asks for “more days” are really asks for more floor time. Reclaim time inside the existing schedule first: tighter ceremonial segments, hard per-item timers, parallel committee work — the timer and agenda tools already enforce this." },
  ai: { title: "Set a device & AI policy for the House floor.", body: "No live AI drafting during Question Hour and Zero Hour; personal devices out only for voting. Judge original argument, not delivery of generated text — the students themselves are asking for this." },
  prep: { title: "Send the prep pack a week early.", body: "Role brief, a procedure one-pager (point of order, amendment, Question Hour flow) and a glossary before event day, so nobody meets the rules for the first time live on the floor." },
  food: { title: "Review the food & refreshments.", body: "Revisit the vendor and menu for the next round. Small cost, repeated mentions, easy win." },
  venue: { title: "Close the venue comfort gaps.", body: "Set the hall AC to a moderate fixed point and walk the seating blocks before doors open." },
};

function tagRows(
  rows: FeedbackResponseRow[],
  buckets: Bucket[],
  texts: (r: FeedbackResponseRow) => Array<string | null>
) {
  return buckets
    .map((b) => ({ ...b, count: rows.filter((r) => texts(r).some((t) => t && b.re.test(t))).length }))
    .filter((b) => b.count > 0)
    .sort((a, b) => b.count - a.count);
}

function dist(rows: FeedbackResponseRow[], pick: (r: FeedbackResponseRow) => number | null) {
  const counts = [5, 4, 3, 2, 1].map((star) => rows.filter((r) => pick(r) === star).length);
  return { counts, max: Math.max(1, ...counts) };
}

function Tile({ label, value, detail, hero }: { label: string; value: string; detail: string; hero?: boolean }) {
  return (
    <div className="rounded-lg border p-4" style={hero ? { background: INK, borderColor: INK } : { background: CARD, borderColor: RULE }}>
      <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: hero ? "#CFCBB8" : INK3 }}>{label}</div>
      <div className="mt-0.5 text-3xl font-bold tabular-nums" style={{ color: hero ? "#F6EFDE" : INK }}>{value}</div>
      <div className="mt-0.5 text-xs" style={{ color: hero ? "#AFAB97" : INK2 }}>{detail}</div>
    </div>
  );
}

function DistCard({ title, avg, rows, pick }: { title: string; avg: number | null; rows: FeedbackResponseRow[]; pick: (r: FeedbackResponseRow) => number | null }) {
  const { counts, max } = dist(rows, pick);
  return (
    <div className="rounded-lg border p-4" style={{ background: CARD, borderColor: RULE }}>
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold" style={{ color: INK }}>{title}</h3>
        <span className="text-sm font-bold tabular-nums" style={{ color: SAFFRON }}>{avg ?? "—"}</span>
      </div>
      {counts.map((n, i) => (
        <div key={i} className="mt-2 grid grid-cols-[26px_1fr_26px] items-center gap-2 text-xs">
          <span className="text-right tabular-nums" style={{ color: INK2 }}>{5 - i}★</span>
          <div className="h-3.5 rounded-r" style={{ background: "#F1EDE1" }}>
            {n > 0 && <div className="h-full rounded-r" style={{ width: `${(n / max) * 100}%`, background: SAFFRON, minWidth: 2 }} />}
          </div>
          <span className="tabular-nums" style={{ color: INK2 }}>{n}</span>
        </div>
      ))}
    </div>
  );
}

export function FeedbackReportBody({
  eventName,
  day1Date,
  stats,
  rows,
}: {
  eventName: string;
  day1Date: string | null;
  stats: FeedbackStats;
  rows: FeedbackResponseRow[];
}) {
  const improveThemes = tagRows(rows, IMPROVE_BUCKETS, (r) => [r.what_didnt_work, r.suggestions]);
  const workedThemes = tagRows(rows, WORKED_BUCKETS, (r) => [r.biggest_takeaway, r.learned_something, r.what_worked]);
  const improveMax = Math.max(1, ...improveThemes.map((t) => t.count));
  const workedMax = Math.max(1, ...workedThemes.map((t) => t.count));

  const voices = rows
    .filter((r) => (r.biggest_takeaway ?? "").trim().length >= 60)
    .sort((a, b) => (b.biggest_takeaway ?? "").length - (a.biggest_takeaway ?? "").length)
    .slice(0, 4);

  const { npsBreakdown, total } = stats;
  const npsN = npsBreakdown.promoter + npsBreakdown.passive + npsBreakdown.detractor;
  const pct = (n: number) => (npsN > 0 ? Math.round((n / npsN) * 100) : 0);
  const recs = improveThemes.map((t) => ({ ...RECOMMENDATIONS[t.key], count: t.count })).filter((r) => r.title);

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : null;

  const others = stats.byType.organizer + stats.byType.volunteer + stats.byType.jury;

  return (
    <div id="yip-report" data-print-root className="-m-2 sm:m-0" style={{ background: PAPER }}>
      <div className="flex h-1.5">
        <span className="flex-1" style={{ background: "#E8842B" }} />
        <span className="flex-1 border-y" style={{ background: "#FFFFFF", borderColor: RULE }} />
        <span className="flex-1" style={{ background: GREEN }} />
      </div>

      <div className="mx-auto max-w-4xl px-6 pb-20">
        <header className="border-b pb-7 pt-10" style={{ borderColor: RULE }}>
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: SAFFRON }}>
              Young Indians Parliament · Post-Event Report
            </p>
            <PrintButton />
          </div>
          <h1 className="mt-2 text-4xl font-bold leading-tight" style={{ fontFamily: SERIF, color: INK, textWrap: "balance" }}>
            {eventName}
            <br />
            Participant Feedback
          </h1>
          <p className="mt-1 text-lg italic" style={{ fontFamily: SERIF, color: INK2 }}>
            What {total} respondents told us — and what the House is asking for next.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm" style={{ color: INK2 }}>
            {day1Date && <span>Event <b style={{ color: INK }}>{fmtDate(day1Date)}</b></span>}
            <span>Responses <b style={{ color: INK }}>{total}</b></span>
            <span>
              Participants <b style={{ color: INK }}>{stats.byType.participant}</b>
              {others > 0 && (
                <>
                  {" "}· Organizers <b style={{ color: INK }}>{stats.byType.organizer}</b> · Volunteers{" "}
                  <b style={{ color: INK }}>{stats.byType.volunteer}</b> · Jury <b style={{ color: INK }}>{stats.byType.jury}</b>
                </>
              )}
            </span>
          </div>
        </header>

        <section className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Tile hero label="Net Promoter Score" value={stats.nps !== null ? `${stats.nps > 0 ? "+" : ""}${stats.nps}` : "—"} detail={`${npsBreakdown.promoter} promoters · ${npsBreakdown.detractor} detractors`} />
          <Tile label="Overall" value={stats.avgOverall?.toString() ?? "—"} detail="out of 5" />
          <Tile label="Organization" value={stats.avgOrganization?.toString() ?? "—"} detail="out of 5" />
          <Tile label="Content" value={stats.avgContent?.toString() ?? "—"} detail="out of 5" />
          <Tile label="Would recommend" value={stats.recommendRate !== null ? `${Math.round(stats.recommendRate * 100)}%` : "—"} detail="say yes" />
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold" style={{ fontFamily: SERIF, color: INK }}>How they rated it</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <DistCard title="Overall experience" avg={stats.avgOverall} rows={rows} pick={(r) => r.overall_rating} />
            <DistCard title="Organization" avg={stats.avgOrganization} rows={rows} pick={(r) => r.organization_rating} />
            <DistCard title="Content & sessions" avg={stats.avgContent} rows={rows} pick={(r) => r.content_rating} />
          </div>
        </section>

        {npsN > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold" style={{ fontFamily: SERIF, color: INK }}>Net Promoter Score</h2>
            <p className="mt-1 max-w-2xl text-sm" style={{ color: INK2 }}>
              &ldquo;How likely are you to recommend YIP?&rdquo; (0&ndash;10). Promoters scored 9&ndash;10, passives 7&ndash;8, detractors 0&ndash;6.
            </p>
            <div className="mt-4 flex h-11 gap-0.5 overflow-hidden rounded-md">
              {npsBreakdown.promoter > 0 && <div className="flex items-center justify-center whitespace-nowrap text-xs font-semibold text-white tabular-nums" style={{ flex: npsBreakdown.promoter, background: GREEN }}>{npsBreakdown.promoter} ({pct(npsBreakdown.promoter)}%)</div>}
              {npsBreakdown.passive > 0 && <div className="flex items-center justify-center whitespace-nowrap text-xs font-semibold text-white tabular-nums" style={{ flex: npsBreakdown.passive, background: AMBER }}>{npsBreakdown.passive} ({pct(npsBreakdown.passive)}%)</div>}
              {npsBreakdown.detractor > 0 && <div className="flex items-center justify-center whitespace-nowrap text-xs font-semibold text-white tabular-nums" style={{ flex: npsBreakdown.detractor, background: RED }}>{npsBreakdown.detractor}</div>}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs" style={{ color: INK2 }}>
              <span><span className="mr-1.5 inline-block size-2.5 rounded-sm align-[-1px]" style={{ background: GREEN }} />Promoters</span>
              <span><span className="mr-1.5 inline-block size-2.5 rounded-sm align-[-1px]" style={{ background: AMBER }} />Passives</span>
              <span><span className="mr-1.5 inline-block size-2.5 rounded-sm align-[-1px]" style={{ background: RED }} />Detractors ({pct(npsBreakdown.detractor)}%)</span>
            </div>
          </section>
        )}

        {(workedThemes.length > 0 || improveThemes.length > 0) && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold" style={{ fontFamily: SERIF, color: INK }}>What the House said</h2>
            <p className="mt-1 max-w-2xl text-sm" style={{ color: INK2 }}>
              Open-text answers auto-grouped by theme. Counts are respondents mentioning each theme; a respondent can appear in more than one.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-5" style={{ background: CARD, borderColor: RULE }}>
                <h3 className="text-lg font-bold" style={{ fontFamily: SERIF, color: INK }}>What worked</h3>
                <p className="text-xs" style={{ color: INK3 }}>From takeaways &amp; learnings</p>
                {workedThemes.map((t) => (
                  <div key={t.key} className="mt-3.5 grid grid-cols-[1fr_34px] items-center gap-3 text-sm">
                    <div>
                      <span className="font-semibold" style={{ color: INK }}>{t.title}</span>
                      <span className="block text-xs" style={{ color: INK2 }}>{t.hint}</span>
                      <div className="mt-1.5 h-2 rounded-r" style={{ width: `${(t.count / workedMax) * 100}%`, background: GREEN }} />
                    </div>
                    <span className="text-right font-bold tabular-nums" style={{ color: INK2 }}>{t.count}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border p-5" style={{ background: CARD, borderColor: RULE }}>
                <h3 className="text-lg font-bold" style={{ fontFamily: SERIF, color: INK }}>What to fix</h3>
                <p className="text-xs" style={{ color: INK3 }}>From improvement suggestions</p>
                {improveThemes.map((t) => (
                  <div key={t.key} className="mt-3.5 grid grid-cols-[1fr_34px] items-center gap-3 text-sm">
                    <div>
                      <span className="font-semibold" style={{ color: INK }}>{t.title}</span>
                      <span className="block text-xs" style={{ color: INK2 }}>{t.hint}</span>
                      <div className="mt-1.5 h-2 rounded-r" style={{ width: `${(t.count / improveMax) * 100}%`, background: RED }} />
                    </div>
                    <span className="text-right font-bold tabular-nums" style={{ color: INK2 }}>{t.count}</span>
                  </div>
                ))}
                {improveThemes.length === 0 && <p className="mt-3 text-sm" style={{ color: INK2 }}>No improvement suggestions yet.</p>}
              </div>
            </div>
            {improveThemes[0]?.key === "speaking" && (
              <div className="mt-5 rounded-r-lg border-l-4 p-5" style={{ background: SAFFRON_SOFT, borderColor: SAFFRON }}>
                <b style={{ fontFamily: SERIF, color: INK }}>The headline finding: demand to speak outstripped supply.</b>
                <p className="mt-1.5 max-w-2xl text-sm" style={{ color: INK2 }}>
                  The single biggest theme is more speaking time and fairer turns. The thing respondents loved most — finding their voice — is the thing they couldn&apos;t get enough of. Fix turn allocation and the score moves; nothing else in the feedback comes close.
                </p>
              </div>
            )}
          </section>
        )}

        {voices.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold" style={{ fontFamily: SERIF, color: INK }}>Voices of the House</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {voices.map((v, i) => (
                <div key={v.id} className={`rounded-lg border p-5 ${i === 0 ? "md:col-span-2" : ""}`} style={i === 0 ? { background: INK, borderColor: INK } : { background: CARD, borderColor: RULE }}>
                  <p className={i === 0 ? "text-lg" : "text-base"} style={{ fontFamily: SERIF, color: i === 0 ? "#F6EFDE" : INK, lineHeight: 1.55 }}>
                    &ldquo;{(v.biggest_takeaway ?? "").trim()}&rdquo;
                  </p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wider" style={{ color: SAFFRON }}>
                    {v.respondent_name ?? "Participant"}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {recs.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold" style={{ fontFamily: SERIF, color: INK }}>Recommendations for the next round</h2>
            <p className="mt-1 text-sm" style={{ color: INK2 }}>Ranked by how much of the feedback each one answers.</p>
            <div className="mt-4 space-y-3">
              {recs.map((r, i) => (
                <div key={r.title} className="grid grid-cols-[44px_1fr] gap-4 rounded-lg border p-5" style={{ background: CARD, borderColor: RULE }}>
                  <span className="text-2xl font-bold tabular-nums" style={{ fontFamily: SERIF, color: SAFFRON }}>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <b className="text-[15px]" style={{ color: INK }}>{r.title}</b>
                    <p className="mt-1 max-w-2xl text-sm" style={{ color: INK2 }}>{r.body}</p>
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: INK3 }}>
                      Raised in {r.count} response{r.count === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-16 flex flex-wrap justify-between gap-3 border-t pt-4 text-xs" style={{ borderColor: RULE, color: INK3 }}>
          <span>Young Indians Parliament · {eventName}</span>
          <span>Auto-generated from {total} feedback response{total === 1 ? "" : "s"} · YIP platform</span>
        </footer>
      </div>
    </div>
  );
}
