/**
 * Command-centre data layer — the follow-up board + milestone timeline for the
 * live edition, plus the "This Week" strip numbers for the dashboard overview.
 *
 * Reads via the admin client (varnam_tasks is RLS-closed committee data; the
 * pages that call this are role-gated). All date bucketing is done on
 * Asia/Kolkata calendar days — organisers work at 1 AM IST, and "overdue"
 * must mean overdue in THEIR day, not UTC's.
 *
 * Defensive: yi_connect.varnam_tasks is being added in this round's migration;
 * every query tolerates the table not existing yet and returns empty data.
 */
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getCurrentEdition } from "./editions";

export type TaskRow = {
  id: string;
  title: string;
  kind: "task" | "milestone";
  owner_name: string | null;
  due_date: string | null; // "YYYY-MM-DD"
  status: "open" | "done";
  details: string | null;
  event_id: string | null;
  event_title?: string;
  completed_at: string | null;
};

export type TaskBoard = {
  overdue: TaskRow[];
  dueThisWeek: TaskRow[];
  later: TaskRow[];
  done: TaskRow[];
  milestones: TaskRow[];
  /** Today's date in Asia/Kolkata ("YYYY-MM-DD") — same clock the buckets used. */
  today: string;
};

const EMPTY_BOARD: TaskBoard = {
  overdue: [],
  dueThisWeek: [],
  later: [],
  done: [],
  milestones: [],
  today: "",
};

// ── IST calendar-day helpers ──────────────────────────────────────────────

/** Today's date in Asia/Kolkata as "YYYY-MM-DD" (en-CA formats ISO-style). */
export function istToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());
}

/** isoDate + n days → "YYYY-MM-DD" (pure calendar math at UTC midnight). */
function addDays(isoDate: string, days: number): string {
  const t = Date.parse(`${isoDate}T00:00:00Z`) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Whole days from `fromIso` to `toIso` (negative when `toIso` is past). */
export function diffDays(fromIso: string, toIso: string): number {
  return Math.round(
    (Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) /
      86_400_000
  );
}

// ── Board ────────────────────────────────────────────────────────────────

type RawRow = {
  id: string;
  title: string;
  kind: string;
  owner_name: string | null;
  due_date: string | null;
  status: string;
  details: string | null;
  event_id: string | null;
  completed_at: string | null;
};

/** All tasks + milestones for the live edition, bucketed for the board. */
export async function getTaskBoard(): Promise<TaskBoard> {
  const today = istToday();
  const edition = await getCurrentEdition();
  if (!edition) return { ...EMPTY_BOARD, today };

  const sb = createAdminSupabaseClient();
  const { data, error } = await sb
    .schema("yi_connect")
    .from("varnam_tasks")
    .select(
      "id, title, kind, owner_name, due_date, status, details, event_id, completed_at"
    )
    .eq("edition_id", edition.id)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  // Defensive: table may not exist yet in this environment.
  if (error || !data) return { ...EMPTY_BOARD, today };

  const rows = (data as RawRow[]).map(
    (r): TaskRow => ({
      id: r.id,
      title: r.title,
      kind: r.kind === "milestone" ? "milestone" : "task",
      owner_name: r.owner_name,
      due_date: r.due_date,
      status: r.status === "done" ? "done" : "open",
      details: r.details,
      event_id: r.event_id,
      completed_at: r.completed_at,
    })
  );

  // Join event titles via a second query (no FK-embed dependency).
  const eventIds = [...new Set(rows.map((r) => r.event_id).filter(Boolean))] as string[];
  if (eventIds.length) {
    const { data: evRaw } = await sb
      .schema("yi_connect")
      .from("events")
      .select("id, title")
      .in("id", eventIds);
    const titleById = new Map(
      ((evRaw ?? []) as { id: string; title: string }[]).map((e) => [
        e.id,
        e.title,
      ])
    );
    for (const r of rows) {
      if (r.event_id) r.event_title = titleById.get(r.event_id);
    }
  }

  const weekEnd = addDays(today, 7);
  const milestones = rows
    .filter((r) => r.kind === "milestone")
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const tasks = rows.filter((r) => r.kind === "task");

  const overdue = tasks.filter(
    (r) => r.status === "open" && r.due_date !== null && r.due_date < today
  );
  const dueThisWeek = tasks.filter(
    (r) =>
      r.status === "open" &&
      r.due_date !== null &&
      r.due_date >= today &&
      r.due_date <= weekEnd
  );
  const later = tasks.filter(
    (r) => r.status === "open" && (r.due_date === null || r.due_date > weekEnd)
  );
  const done = tasks
    .filter((r) => r.status === "done")
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));

  return { overdue, dueThisWeek, later, done, milestones, today };
}

// ── Add-task form options ────────────────────────────────────────────────

/** Live-edition events (all statuses) for the optional event <select>. */
export async function getTaskEventOptions(): Promise<
  { id: string; title: string }[]
> {
  const edition = await getCurrentEdition();
  if (!edition) return [];
  const sb = createAdminSupabaseClient();
  const { data } = await sb
    .schema("yi_connect")
    .from("events")
    .select("id, title")
    .eq("festival_edition_id", edition.id)
    .order("start_date", { ascending: true });
  return ((data ?? []) as { id: string; title: string }[]).map((e) => ({
    id: e.id,
    title: e.title,
  }));
}

// ── "This Week" strip (dashboard overview) ───────────────────────────────

export type WeekAhead = {
  /** Open tasks past their due date (IST). */
  overdueCount: number;
  /** Open tasks due within the next 7 days. */
  dueThisWeekCount: number;
  /** Next open milestone on/after today, with whole days to go. */
  nextMilestone: { title: string; due_date: string; daysToGo: number } | null;
  /** Whole days until the festival opens (negative once underway); null if unknown. */
  festivalStartsInDays: number | null;
  /** Edition start date ("YYYY-MM-DD"), for display. */
  festivalStartDate: string | null;
};

/** Compact numbers for the dashboard's "This Week" strip. */
export async function getWeekAhead(): Promise<WeekAhead> {
  const board = await getTaskBoard();
  const today = board.today || istToday();

  const nextOpen = board.milestones.find(
    (m) => m.status === "open" && m.due_date !== null && m.due_date >= today
  );
  const nextMilestone = nextOpen?.due_date
    ? {
        title: nextOpen.title,
        due_date: nextOpen.due_date,
        daysToGo: diffDays(today, nextOpen.due_date),
      }
    : null;

  const edition = await getCurrentEdition();
  const festivalStartDate = edition?.start_date
    ? edition.start_date.slice(0, 10)
    : null;
  const festivalStartsInDays = festivalStartDate
    ? diffDays(today, festivalStartDate)
    : null;

  return {
    overdueCount: board.overdue.length,
    dueThisWeekCount: board.dueThisWeek.length,
    nextMilestone,
    festivalStartsInDays,
    festivalStartDate,
  };
}
