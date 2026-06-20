import Link from "next/link";
import { Newsreader } from "next/font/google";
import { getNationalOverview, listOrganizerProfiles } from "@/app/yip/actions/hierarchy";
import { Landmark, ArrowRight, CalendarDays, AlertTriangle, Check, X } from "lucide-react";
import type { YiZone } from "@/lib/yip/hierarchy";

const display = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function fmtDate(d: string): { mon: string; day: string } {
  const [, m, day] = d.split("-").map(Number);
  return { mon: MONTHS[(m ?? 1) - 1] ?? "—", day: String(day ?? 1).padStart(2, "0") };
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0] ?? "")
    .join("")
    .toUpperCase();
}

const BAR = ["bg-[#FF9933]", "bg-[#1a1a3e]", "bg-[#138808]"];

// Roughly geographic placement of the six Yi zones on a 5x4 grid (a schematic
// map of India, not a literal outline).
const ZONE_POS: Record<YiZone, string> = {
  NR: "col-start-2 col-end-5 row-start-1 row-end-2",
  NER: "col-start-5 col-end-6 row-start-1 row-end-3",
  WR: "col-start-1 col-end-2 row-start-2 row-end-4",
  ER: "col-start-3 col-end-5 row-start-2 row-end-3",
  SRTKKA: "col-start-2 col-end-4 row-start-3 row-end-4",
  SRTN: "col-start-3 col-end-5 row-start-4 row-end-5",
};

export default async function ZonesNationalPage() {
  const [overview, national] = await Promise.all([
    getNationalOverview(),
    listOrganizerProfiles({ role: "national" }),
  ]);

  const { totals, zones, upcoming, liveEvent, thisWeek, needsAttention } = overview;
  const setup = Math.max(0, totals.events - totals.live - totals.published);
  const topZone = zones[0];
  const notStarted = zones.filter((z) => !z.started).map((z) => z.label);
  const byParticipation = [...zones]
    .filter((z) => z.participants > 0)
    .sort((a, b) => b.participants - a.participants);
  const maxEvents = Math.max(1, ...zones.map((z) => z.events));

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      {/* Masthead */}
      <header className="relative overflow-hidden rounded-[20px] border border-[#1a1a3e]/10 bg-white">
        <div
          className="h-1 w-full"
          style={{
            background:
              "linear-gradient(90deg,#FF9933 0%,#FF9933 33%,#ffffff 33%,#ffffff 66%,#138808 66%,#138808 100%)",
          }}
        />
        <div className="px-7 py-7">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#FF9933]">
                YIP 2026 · National Command
              </div>
              <h1
                className={`${display.className} text-[40px] leading-[1.05] font-medium text-[#1a1a3e] mt-1 tracking-tight`}
              >
                National Overview
              </h1>
              <p className="text-sm text-[#1a1a3e]/55 mt-2 max-w-xl">
                The Parliament rolls out across India —{" "}
                <span className="font-semibold text-[#1a1a3e]/80">{totals.events} sittings</span> seeded in{" "}
                <span className="font-semibold text-[#1a1a3e]/80">{totals.zones} regions</span>
                {liveEvent ? ", one live right now." : "."}
              </p>
            </div>
            {liveEvent && (
              <div className="flex items-center gap-2 rounded-full border border-[#138808]/25 bg-[#138808]/5 px-3 py-1.5">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#138808] opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-[#138808]" />
                </span>
                <span className="text-xs font-semibold text-[#138808]">Live now · {liveEvent.name}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* National team */}
      {national.length > 0 && (
        <section className="rounded-2xl border border-[#1a1a3e]/8 bg-white overflow-hidden">
          <div className="px-6 pt-5 pb-2 flex items-center gap-2">
            <Landmark className="size-4 text-[#FF9933]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1a1a3e]/55">
              National Team 2026
            </span>
          </div>
          <div className="px-6 pb-5 flex flex-wrap gap-x-7 gap-y-4">
            {national.map((n) => {
              const isAdmin = (n.title ?? "").toLowerCase().includes("admin");
              return (
                <div key={n.id} className="flex items-center gap-3">
                  <div
                    className={`size-10 rounded-full grid place-items-center text-white font-bold text-sm bg-gradient-to-br ${
                      isAdmin ? "from-[#FF9933] to-[#E68A2E]" : "from-[#1a1a3e] to-[#3a3a6e]"
                    }`}
                  >
                    {initials(n.full_name)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#1a1a3e]">{n.full_name}</div>
                    <div className="text-xs text-[#1a1a3e]/55">{n.title ?? "Organizer"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Needs attention — actionable, top of page */}
      {needsAttention.length > 0 && (
        <section className="rounded-2xl border border-[#1a1a3e]/8 bg-white overflow-hidden">
          <div className="px-6 pt-5 pb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1a1a3e]/55 flex items-center gap-2">
              <AlertTriangle className="size-4 text-[#cc3a21]" /> Needs attention
            </span>
            <span className="text-[11px] text-[#1a1a3e]/45 tabular-nums">
              {needsAttention.length} {needsAttention.length === 1 ? "item" : "items"}
            </span>
          </div>
          <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-1">
            {needsAttention.map((n) => (
              <div
                key={n.id}
                className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-[#1a1a3e]/[0.03] transition-colors"
              >
                <span
                  className={`mt-1.5 size-2 rounded-full shrink-0 ${
                    n.severity === "high" ? "bg-[#cc3a21]" : "bg-[#FF9933]"
                  }`}
                />
                <div>
                  <div className="text-sm font-semibold text-[#1a1a3e]">{n.title}</div>
                  <div className="text-xs text-[#1a1a3e]/55">{n.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* This week */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MomentumCard
          value={`+${thisWeek.newStudents}`}
          tone="green"
          head="students this week"
          sub="new enrolments · last 7 days"
        />
        <MomentumCard
          value={`+${thisWeek.newEvents}`}
          tone="ink"
          head="events added this week"
          sub="seeded · last 7 days"
        />
        <MomentumCard
          value={thisWeek.daysToNext != null ? String(thisWeek.daysToNext) : "—"}
          tone="saffron"
          head={thisWeek.daysToNext != null ? "days to next sitting" : "no sitting scheduled"}
          sub={thisWeek.nextName ?? "set a date to see a countdown"}
        />
      </section>

      {/* Next up + readiness */}
      {upcoming.length > 0 && (
        <section className="rounded-2xl border border-[#1a1a3e]/8 bg-white px-6 py-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1a1a3e]/55 flex items-center gap-2">
              <CalendarDays className="size-3.5" /> Next up — and are they ready?
            </span>
            <span className="text-[11px] text-[#1a1a3e]/45">
              {upcoming.length} upcoming · confirmed dates
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {upcoming.map((e) => {
              const d = fmtDate(e.day1_date);
              return (
                <div
                  key={e.id}
                  className={`rounded-xl px-4 py-3 ${
                    e.ready
                      ? "border border-[#138808]/30 bg-[#138808]/[0.02]"
                      : "border border-[#1a1a3e]/8"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold text-[#FF9933] tabular-nums">
                      {d.mon} {d.day}
                    </div>
                    {e.ready && <span className="text-[10px] font-semibold text-[#138808]">READY</span>}
                  </div>
                  <div className="font-semibold text-sm mt-0.5 text-[#1a1a3e] truncate">{e.name}</div>
                  <div className="text-xs text-[#1a1a3e]/50 truncate mb-2.5">{e.label}</div>
                  <div className="flex gap-1.5">
                    <ReadyPill ok={e.rosterLoaded} label="Roster" />
                    <ReadyPill ok={e.juryAssigned} label="Jury" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Pulse: hero + supporting */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.1fr_2fr] gap-4">
        <div className="relative overflow-hidden rounded-2xl border border-[#1a1a3e]/8 bg-white px-7 py-6">
          <div className="absolute -right-8 -top-8 size-32 rounded-full bg-[#FF9933]/8" />
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1a1a3e]/45">
            Students enrolled
          </div>
          <div
            className={`${display.className} text-[64px] leading-none font-medium text-[#1a1a3e] mt-1 tabular-nums`}
          >
            {totals.participants}
          </div>
          <div className="text-sm text-[#1a1a3e]/55 mt-2">
            from <span className="font-semibold text-[#1a1a3e]/80">{totals.schools} schools</span> · across{" "}
            <span className="font-semibold text-[#1a1a3e]/80">
              {totals.startedZones} of {totals.zones} zones
            </span>{" "}
            so far
          </div>
          {byParticipation.length > 0 && (
            <>
              <div className="mt-4 h-1.5 w-full rounded-full bg-[#1a1a3e]/8 overflow-hidden flex">
                {byParticipation.slice(0, 3).map((z, i) => (
                  <div key={z.code} className={`h-full ${BAR[i]}`} style={{ width: `${z.sharePct}%` }} />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#1a1a3e]/55">
                {byParticipation.slice(0, 3).map((z, i) => (
                  <span key={z.code} className="tabular-nums">
                    <span className={`inline-block size-2 rounded-full ${BAR[i]} mr-1 align-middle`} />
                    {z.label} {z.participants}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard value={totals.zones} label="Active zones" />
          <StatCard value={totals.chapters} label="Chapters engaged" />
          <StatCard value={totals.events} label="Events seeded" />
          <StatCard value={totals.published} label="Results published" accent />
          <div className="col-span-2 sm:col-span-4 rounded-2xl border border-[#1a1a3e]/8 bg-white px-5 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#1a1a3e]/45 mb-3">
              Program pipeline
            </div>
            <div className="flex items-center gap-2">
              <PipeStep value={setup} label="In setup" tone="ink" />
              <ArrowRight className="size-4 text-[#1a1a3e]/25 shrink-0" />
              <PipeStep value={totals.live} label="Live now" tone="saffron" />
              <ArrowRight className="size-4 text-[#1a1a3e]/25 shrink-0" />
              <PipeStep value={totals.published} label="Results out" tone="green" />
            </div>
          </div>
        </div>
      </section>

      {/* Insights */}
      {topZone && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <InsightCard
            eyebrow="Front-runner"
            tone="saffron"
            title={`${topZone.label} leads the rollout`}
            body={`${topZone.events} events · ${topZone.chapters} chapters · ${topZone.participants} students${
              topZone.sharePct >= 40 ? " — nearly half of all enrolment." : "."
            }`}
          />
          <InsightCard
            eyebrow="Scheduling"
            tone="ink"
            title={`${totals.scheduled} ${totals.scheduled === 1 ? "event is" : "events are"} on the calendar`}
            body={`${totals.awaitingDates} of ${totals.events} still need confirmed dates — the season is mostly unscheduled.`}
          />
          <InsightCard
            eyebrow="Coverage"
            tone="green"
            title={`Registration has begun in ${totals.startedZones} ${
              totals.startedZones === 1 ? "zone" : "zones"
            }`}
            body={
              notStarted.length > 0
                ? `${listJoin(notStarted)} ${
                    notStarted.length === 1 ? "has" : "have"
                  } chapters but no students enrolled yet.`
                : "Every zone has students enrolled."
            }
          />
        </section>
      )}

      {/* Across India map */}
      <section className="rounded-2xl border border-[#1a1a3e]/8 bg-white px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1a1a3e]/55">
            Across India · activity by zone
          </span>
          <span className="text-[11px] text-[#1a1a3e]/45">shaded by events</span>
        </div>
        <div
          className="mx-auto max-w-[560px] grid grid-cols-5 grid-rows-4 gap-2"
          style={{ aspectRatio: "5 / 4" }}
        >
          {zones.map((z) => {
            const isTop = z.events === maxEvents;
            const opacity = isTop ? 1 : 0.35 + 0.5 * (z.events / maxEvents);
            return (
              <Link
                key={z.code}
                href={`/yip/dashboard/zones/${z.code.toLowerCase()}`}
                className={`rounded-xl flex flex-col justify-center px-3 py-2 text-white transition-transform hover:scale-[1.02] ${ZONE_POS[z.code]}`}
                style={{ backgroundColor: isTop ? "#FF9933" : "#1a1a3e", opacity }}
              >
                <div className="text-xs font-semibold leading-tight">{z.label}</div>
                <div className="text-[11px] tabular-nums" style={{ opacity: 0.85 }}>
                  {z.events} events · {z.participants} students
                </div>
              </Link>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-2 mt-4 text-[10px] text-[#1a1a3e]/50">
          <span>fewer events</span>
          <span className="h-2 w-6 rounded-full bg-[#1a1a3e]" style={{ opacity: 0.35 }} />
          <span className="h-2 w-6 rounded-full bg-[#1a1a3e]" style={{ opacity: 0.62 }} />
          <span className="h-2 w-6 rounded-full bg-[#1a1a3e]" style={{ opacity: 0.85 }} />
          <span className="h-2 w-6 rounded-full bg-[#FF9933]" />
          <span>most active</span>
        </div>
      </section>

      {/* Zone leaderboard */}
      <section>
        <div className="mb-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1a1a3e]/55">
            Zones ranked by activity
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map((z, i) => (
            <Link
              key={z.code}
              href={`/yip/dashboard/zones/${z.code.toLowerCase()}`}
              className="block rounded-2xl border border-[#1a1a3e]/8 bg-white px-5 py-4 hover:border-[#FF9933]/40 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`${display.className} text-[26px] font-medium text-[#1a1a3e]/25 tabular-nums w-7 shrink-0`}
                  >
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-[#1a1a3e] leading-tight truncate">{z.label}</h3>
                    <div className="text-[11px] font-mono text-[#1a1a3e]/40">{z.code}</div>
                  </div>
                </div>
                {z.published > 0 ? (
                  <span className="rounded-full bg-[#138808]/10 text-[#138808] text-[10px] font-semibold px-2 py-0.5 shrink-0">
                    {z.published} published
                  </span>
                ) : z.started ? (
                  <span className="rounded-full bg-[#FF9933]/10 text-[#FF9933] text-[10px] font-semibold px-2 py-0.5 shrink-0">
                    registering
                  </span>
                ) : (
                  <span className="rounded-full bg-[#1a1a3e]/5 text-[#1a1a3e]/50 text-[10px] font-semibold px-2 py-0.5 shrink-0">
                    awaiting enrolment
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-[#1a1a3e]/5 tabular-nums">
                <ZoneStat value={z.events} label="Events" />
                <ZoneStat value={z.chapters} label="Chapters" />
                <ZoneStat value={z.participants} label="Students" dim={z.participants === 0} />
              </div>
              <div className="mt-3">
                <div className="h-1 w-full rounded-full bg-[#1a1a3e]/8 overflow-hidden">
                  <div
                    className={z.started ? "h-full bg-[#FF9933]" : "h-full bg-[#1a1a3e]/20"}
                    style={{ width: z.started ? `${Math.max(z.sharePct, 4)}%` : "3%" }}
                  />
                </div>
                <div className="text-[10px] text-[#1a1a3e]/45 mt-1">
                  {z.started ? `${z.sharePct}% of national enrolment` : "registration not started"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function MomentumCard({
  value,
  head,
  sub,
  tone,
}: {
  value: string;
  head: string;
  sub: string;
  tone: "green" | "ink" | "saffron";
}) {
  const color = { green: "text-[#138808]", ink: "text-[#1a1a3e]", saffron: "text-[#FF9933]" }[tone];
  return (
    <div className="rounded-2xl border border-[#1a1a3e]/8 bg-white px-5 py-4 flex items-center gap-4">
      <div className={`${display.className} text-[40px] leading-none font-medium tabular-nums ${color}`}>
        {value}
      </div>
      <div>
        <div className="text-sm font-semibold text-[#1a1a3e]">{head}</div>
        <div className="text-xs text-[#1a1a3e]/55">{sub}</div>
      </div>
    </div>
  );
}

function ReadyPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${
        ok ? "bg-[#138808]/10 text-[#138808]" : "bg-[#cc3a21]/8 text-[#cc3a21]"
      }`}
    >
      {ok ? <Check className="size-3" /> : <X className="size-3" />}
      {label}
    </span>
  );
}

function StatCard({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-[#1a1a3e]/8 bg-white px-5 py-5">
      <div
        className={`text-[34px] font-bold leading-none tabular-nums ${accent ? "text-[#138808]" : "text-[#1a1a3e]"}`}
      >
        {value}
      </div>
      <div className="text-xs text-[#1a1a3e]/55 mt-1.5">{label}</div>
    </div>
  );
}

function PipeStep({ value, label, tone }: { value: number; label: string; tone: "ink" | "saffron" | "green" }) {
  const map = {
    ink: { bg: "bg-[#1a1a3e]/5", text: "text-[#1a1a3e]" },
    saffron: { bg: "bg-[#FF9933]/10", text: "text-[#FF9933]" },
    green: { bg: "bg-[#138808]/10", text: "text-[#138808]" },
  }[tone];
  return (
    <div className={`flex-1 rounded-lg ${map.bg} px-3 py-2.5`}>
      <div className={`text-xl font-bold tabular-nums ${map.text}`}>{value}</div>
      <div className="text-[11px] text-[#1a1a3e]/55">{label}</div>
    </div>
  );
}

function InsightCard({
  eyebrow,
  title,
  body,
  tone,
}: {
  eyebrow: string;
  title: string;
  body: string;
  tone: "saffron" | "ink" | "green";
}) {
  const border = { saffron: "border-l-[#FF9933]", ink: "border-l-[#1a1a3e]", green: "border-l-[#138808]" }[tone];
  const text = { saffron: "text-[#FF9933]", ink: "text-[#1a1a3e]/60", green: "text-[#138808]" }[tone];
  return (
    <div className={`rounded-2xl border border-[#1a1a3e]/8 border-l-[3px] ${border} bg-white px-5 py-5`}>
      <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${text}`}>{eyebrow}</div>
      <div className={`${display.className} text-lg font-medium mt-1.5 leading-snug text-[#1a1a3e]`}>{title}</div>
      <div className="text-sm text-[#1a1a3e]/60 mt-1.5 tabular-nums">{body}</div>
    </div>
  );
}

function ZoneStat({ value, label, dim }: { value: number; label: string; dim?: boolean }) {
  return (
    <div>
      <div className={`text-sm font-bold ${dim ? "text-[#1a1a3e]/40" : "text-[#1a1a3e]"}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-[#1a1a3e]/45">{label}</div>
    </div>
  );
}
