"use client";

import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { VOLUNTEER_STATIONS, type VolunteerStation } from "@/lib/yip/volunteers";
import {
  getRegistrationRoster,
  registrationSetDayCheckIn,
  getJurySupportData,
  getHelpDeskInfo,
  getVolunteerTasks,
  setVolunteerTaskDone,
  type RegRosterMember,
  type JurySupportData,
  type HelpDeskInfo,
  type VolunteerTask,
} from "@/app/yip/actions/volunteer-station";

const SAFFRON = "#FF9933";
const INK = "#1a1a3e";

const STATION_LABEL: Record<string, string> = Object.fromEntries(
  VOLUNTEER_STATIONS.map((s) => [s.code, s.label])
);

// ─── Router: pick the tool for the volunteer's station ──────────────
export function StationTool({
  eventId,
  station,
}: {
  eventId: string;
  station: VolunteerStation | null;
}) {
  switch (station) {
    case "registration":
      return <RegistrationTool eventId={eventId} />;
    case "jury_support":
      return <JurySupportTool eventId={eventId} />;
    case "help_desk":
      return <HelpDeskTool eventId={eventId} />;
    case "runner":
    case "organiser_helper":
      return <RunnerTool eventId={eventId} />;
    default:
      return <GenericStation station={station} />;
  }
}

// ─── (a) Registration: search + check students in (Day 1 / Day 2) ───
function RegistrationTool({ eventId }: { eventId: string }) {
  const [roster, setRoster] = useState<RegRosterMember[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [day, setDay] = useState<1 | 2>(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await getRegistrationRoster(eventId);
    if (r.success) setRoster(r.data);
    else setErr(r.error);
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!roster) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return roster;
    return roster.filter(
      (m) =>
        m.full_name.toLowerCase().includes(needle) ||
        (m.constituency_name ?? "").toLowerCase().includes(needle) ||
        String(m.serial_no ?? "").includes(needle)
    );
  }, [roster, q]);

  async function toggle(m: RegRosterMember) {
    const current = day === 1 ? m.checked_in_day1 : m.checked_in_day2;
    setBusyId(m.id);
    const r = await registrationSetDayCheckIn(eventId, m.id, day, !current);
    setBusyId(null);
    if (!r.success) {
      toast.error(r.error);
      return;
    }
    setRoster((prev) =>
      (prev ?? []).map((x) =>
        x.id === m.id
          ? {
              ...x,
              checked_in_day1: day === 1 ? !current : x.checked_in_day1,
              checked_in_day2: day === 2 ? !current : x.checked_in_day2,
            }
          : x
      )
    );
  }

  if (err) return <Banner tone="warn">{err}</Banner>;
  if (!roster) return <Banner>Loading the roster…</Banner>;

  const presentCount = roster.filter((m) =>
    day === 1 ? m.checked_in_day1 : m.checked_in_day2
  ).length;

  return (
    <ToolShell title="Registration Desk" subtitle="Check students in as they arrive">
      <div className="flex items-center gap-2">
        <DayToggle day={day} setDay={setDay} />
        <span className="ml-auto text-xs font-semibold" style={{ color: INK }}>
          {presentCount}/{roster.length} in
        </span>
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name, constituency or serial no…"
        className="w-full rounded-lg border-2 border-[#1a1a3e]/10 px-3 py-2 text-sm focus:border-[#FF9933] focus:outline-none"
      />
      <div className="space-y-2">
        {filtered.length === 0 && <Empty>No students match.</Empty>}
        {filtered.slice(0, 80).map((m) => {
          const present = day === 1 ? m.checked_in_day1 : m.checked_in_day2;
          return (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-xl border border-[#1a1a3e]/8 bg-white px-3 py-2.5 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold" style={{ color: INK }}>
                  {m.full_name}
                </p>
                <p className="truncate text-xs text-[#1a1a3e]/45">
                  {[
                    m.serial_no != null ? `#${m.serial_no}` : null,
                    m.constituency_name,
                    m.committee_name,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
              </div>
              <button
                type="button"
                disabled={busyId === m.id}
                onClick={() => toggle(m)}
                className={
                  "shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 " +
                  (present
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-[#FF9933] text-white")
                }
              >
                {busyId === m.id ? "…" : present ? "✓ In" : "Check in"}
              </button>
            </div>
          );
        })}
        {filtered.length > 80 && (
          <p className="py-2 text-center text-xs text-[#1a1a3e]/40">
            Showing first 80 — refine your search.
          </p>
        )}
      </div>
    </ToolShell>
  );
}

function DayToggle({
  day,
  setDay,
}: {
  day: 1 | 2;
  setDay: (d: 1 | 2) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border-2 border-[#1a1a3e]/10">
      {[1, 2].map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => setDay(d as 1 | 2)}
          className="px-3 py-1.5 text-xs font-bold transition-colors"
          style={{
            backgroundColor: day === d ? SAFFRON : "transparent",
            color: day === d ? "#fff" : "#1a1a3e80",
          }}
        >
          Day {d}
        </button>
      ))}
    </div>
  );
}

// ─── (b) Jury support: read-only schedule + scoring progress ────────
function JurySupportTool({ eventId }: { eventId: string }) {
  const [data, setData] = useState<JurySupportData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getJurySupportData(eventId).then((r) =>
      r.success ? setData(r.data) : setErr(r.error)
    );
  }, [eventId]);

  if (err) return <Banner tone="warn">{err}</Banner>;
  if (!data) return <Banner>Loading the jury schedule…</Banner>;

  return (
    <ToolShell
      title="Jury Support"
      subtitle={`${data.totalJurors} juror${data.totalJurors === 1 ? "" : "s"} on the bench`}
    >
      {data.sessions.length === 0 && (
        <Empty>No scoreable sessions on the agenda yet.</Empty>
      )}
      {data.sessions.map((s) => {
        const complete = data.totalJurors > 0 && s.scoredJurors >= data.totalJurors;
        return (
          <div
            key={s.id}
            className="rounded-xl border border-[#1a1a3e]/8 bg-white p-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold" style={{ color: INK }}>
                  {s.title}
                </p>
                <p className="text-[11px] uppercase tracking-wide text-[#1a1a3e]/40">
                  Day {s.day}
                </p>
              </div>
              <span
                className={
                  "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold " +
                  (complete
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700")
                }
              >
                {s.scoredJurors}/{data.totalJurors} scored
              </span>
            </div>
            {s.description && (
              <p className="mt-1 text-xs text-[#1a1a3e]/55">{s.description}</p>
            )}
          </div>
        );
      })}
      <p className="text-[11px] text-[#1a1a3e]/40">
        Read-only. Help any juror who is behind, but scores are entered by the
        jurors themselves.
      </p>
    </ToolShell>
  );
}

// ─── (c) Help desk: live agenda + host-chapter chair contact ────────
function HelpDeskTool({ eventId }: { eventId: string }) {
  const [info, setInfo] = useState<HelpDeskInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await getHelpDeskInfo(eventId);
    if (r.success) setInfo(r.data);
    else setErr(r.error);
  }, [eventId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // refresh "now" every 15s
    return () => clearInterval(t);
  }, [load]);

  if (err) return <Banner tone="warn">{err}</Banner>;
  if (!info) return <Banner>Loading info…</Banner>;

  return (
    <ToolShell title="Help Desk" subtitle={info.eventName ?? "Event information"}>
      <section className="rounded-xl border border-[#1a1a3e]/8 bg-white p-3 shadow-sm">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#FF9933]">
          Happening now
        </h3>
        {info.now ? (
          <>
            <p className="mt-1 text-base font-bold" style={{ color: INK }}>
              {info.now.title}
            </p>
            <p className="text-xs text-[#1a1a3e]/45">
              {info.now.day ? `Day ${info.now.day}` : ""}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-[#1a1a3e]/55">
            Nothing live on the floor right now.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-[#1a1a3e]/8 bg-white p-3 shadow-sm">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#FF9933]">
          Chapter chair — escalate here
        </h3>
        {info.chapter && (info.chapter.chairName || info.chapter.chairMobile) ? (
          <div className="mt-1 space-y-1">
            {info.chapter.chairName && (
              <p className="text-sm font-semibold" style={{ color: INK }}>
                {info.chapter.chairName}
                {info.chapter.name ? (
                  <span className="font-normal text-[#1a1a3e]/45">
                    {" "}
                    · {info.chapter.name}
                  </span>
                ) : null}
              </p>
            )}
            {info.chapter.chairMobile && (
              <a
                href={`tel:${info.chapter.chairMobile}`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#FF9933]"
              >
                📞 {info.chapter.chairMobile}
              </a>
            )}
            {info.chapter.chairEmail && (
              <a
                href={`mailto:${info.chapter.chairEmail}`}
                className="block truncate text-xs text-[#1a1a3e]/55"
              >
                ✉️ {info.chapter.chairEmail}
              </a>
            )}
          </div>
        ) : (
          <p className="mt-1 text-sm text-[#1a1a3e]/55">
            No chair contact on file. Ask an organiser.
          </p>
        )}
      </section>
    </ToolShell>
  );
}

// ─── (d) Runner / organiser-helper: task feed ───────────────────────
function RunnerTool({ eventId }: { eventId: string }) {
  const [tasks, setTasks] = useState<VolunteerTask[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await getVolunteerTasks(eventId);
    if (r.success) setTasks(r.data);
    else setErr(r.error);
  }, [eventId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000); // poll for new tasks
    return () => clearInterval(t);
  }, [load]);

  async function setDone(task: VolunteerTask, done: boolean) {
    setBusyId(task.id);
    const r = await setVolunteerTaskDone(eventId, task.id, done);
    setBusyId(null);
    if (!r.success) {
      toast.error(r.error);
      return;
    }
    load();
  }

  if (err) return <Banner tone="warn">{err}</Banner>;
  if (!tasks) return <Banner>Loading tasks…</Banner>;

  const open = tasks.filter((t) => t.status === "open");
  const done = tasks.filter((t) => t.status !== "open");

  return (
    <ToolShell title="Runner Tasks" subtitle="Jobs posted by the organisers">
      {open.length === 0 && (
        <Empty>No open tasks right now. Stay ready 👍</Empty>
      )}
      {open.map((t) => (
        <TaskRow key={t.id} task={t} busy={busyId === t.id} onToggle={() => setDone(t, true)} done={false} />
      ))}

      {done.length > 0 && (
        <>
          <p className="pt-2 text-[11px] font-bold uppercase tracking-wide text-[#1a1a3e]/35">
            Done ({done.length})
          </p>
          {done.slice(0, 10).map((t) => (
            <TaskRow key={t.id} task={t} busy={busyId === t.id} onToggle={() => setDone(t, false)} done />
          ))}
        </>
      )}
    </ToolShell>
  );
}

function TaskRow({
  task,
  busy,
  onToggle,
  done,
}: {
  task: VolunteerTask;
  busy: boolean;
  onToggle: () => void;
  done: boolean;
}) {
  return (
    <div
      className={
        "flex items-start gap-3 rounded-xl border px-3 py-2.5 shadow-sm " +
        (done ? "border-[#1a1a3e]/6 bg-[#1a1a3e]/[0.02]" : "border-[#1a1a3e]/8 bg-white")
      }
    >
      <div className="min-w-0 flex-1">
        <p
          className={
            "text-sm font-semibold " + (done ? "text-[#1a1a3e]/40 line-through" : "")
          }
          style={done ? undefined : { color: INK }}
        >
          {task.title}
        </p>
        {task.detail && !done && (
          <p className="mt-0.5 text-xs text-[#1a1a3e]/55">{task.detail}</p>
        )}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onToggle}
        className={
          "shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 " +
          (done ? "bg-[#1a1a3e]/8 text-[#1a1a3e]/55" : "bg-emerald-500 text-white")
        }
      >
        {busy ? "…" : done ? "Undo" : "Done"}
      </button>
    </div>
  );
}

// ─── Generic default for stations with no dedicated tool ────────────
function GenericStation({ station }: { station: VolunteerStation | null }) {
  const label = station ? STATION_LABEL[station] ?? "Volunteer" : null;
  return (
    <ToolShell title={label ?? "Volunteer Desk"} subtitle="Your station">
      {station ? (
        <p className="text-sm text-[#1a1a3e]/70">
          You&apos;re on the <span className="font-semibold">{label}</span> team.
          There&apos;s no checklist tool for this station — follow the organisers&apos;
          briefing and watch the floor. Tap <span className="font-semibold">Now</span>{" "}
          below to see what&apos;s happening live.
        </p>
      ) : (
        <p className="text-sm text-[#1a1a3e]/70">
          You haven&apos;t been given a station yet. Please see an organiser — once
          you&apos;re assigned a station (Registration, Help Desk, Jury Support,
          Runner…) your tools will appear here. In the meantime, tap{" "}
          <span className="font-semibold">Now</span> below for the live agenda.
        </p>
      )}
    </ToolShell>
  );
}

// ─── Shared shells ──────────────────────────────────────────────────
function ToolShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <header>
        <h2 className="text-base font-bold" style={{ color: INK }}>
          {title}
        </h2>
        {subtitle && <p className="text-xs text-[#1a1a3e]/45">{subtitle}</p>}
      </header>
      {children}
    </div>
  );
}

function Banner({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warn";
}) {
  const cls =
    tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-[#1a1a3e]/8 bg-white text-[#1a1a3e]/70";
  return (
    <div
      className={`rounded-2xl border px-4 py-6 text-center text-sm font-medium shadow-sm ${cls}`}
    >
      {children}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#1a1a3e]/8 bg-white px-4 py-6 text-center text-sm text-[#1a1a3e]/45">
      {children}
    </div>
  );
}
