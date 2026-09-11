/**
 * Varnam Vizha — WhatsApp-ready daily digest (E4).
 *
 * Composes one plain-text message the committee can paste straight into the
 * WhatsApp group: countdown, overdue follow-ups, this week's tasks, next
 * milestone, permission-letter progress, registration momentum, and the
 * coming week's events. Formatting uses WhatsApp conventions (*bold* via
 * asterisks), emoji-light, capped lists.
 *
 * Reads via the admin client (dashboard-grade data; the page that renders
 * this is role-gated and the API route is secret-gated). Deliberately
 * cookie-free so it also works from a cron/route context.
 *
 * DEFENSIVE READS: yi_connect.varnam_tasks and yi_connect.varnam_permissions
 * are created by sibling migrations in this same round. If either table is
 * missing (or any query errors), that section is silently omitted — the
 * digest never crashes over an optional section.
 */
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export type Digest = {
  /** WhatsApp-ready plain text. */
  text: string;
  /** ISO timestamp of when this digest was generated. */
  generatedAt: string;
};

const IST = "Asia/Kolkata";
const DASHBOARD_URL = "https://yi-connect-app.vercel.app/varnam-vizha/dashboard";
const FESTIVAL_KEY = "varnam-vizha";
/** Hard cap per list — 6 lines total, including the "…and K more" line. */
const MAX_LIST_LINES = 6;

// ---------------------------------------------------------------------------
// Local row shapes (varnam_tasks / varnam_permissions are other agents'
// tables — no generated types; cast defensively).
// ---------------------------------------------------------------------------
type EditionRow = {
  id: string;
  year: number | null;
  start_date: string | null;
  end_date: string | null;
};
type EventRow = {
  id: string;
  title: string;
  start_date: string | null;
  status: string | null;
};
type TaskRow = {
  title: string;
  owner_name: string | null;
  due_date: string | null; // date column → 'YYYY-MM-DD'
};
type PermissionRow = { status: string | null };

// ---------------------------------------------------------------------------
// IST date helpers — the committee lives in IST; all "today"/"this week"
// boundaries are IST calendar days, not server-timezone days.
// ---------------------------------------------------------------------------

/** 'YYYY-MM-DD' for a Date, in IST. */
function istDateString(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Whole IST calendar days from `now` until `iso` (negative = past). */
function daysUntilIst(iso: string, now: Date): number {
  const target = Date.parse(istDateString(new Date(iso)));
  const today = Date.parse(istDateString(now));
  return Math.round((target - today) / 86_400_000);
}

/** Short human date, e.g. 'Thu 16 Jul'. Accepts date-only or timestamptz. */
function fmtDay(iso: string): string {
  const d =
    iso.length === 10 ? new Date(`${iso}T00:00:00+05:30`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

/** Header date, e.g. '14 July 2026'. */
function fmtHeaderDate(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Add `days` to a 'YYYY-MM-DD' string (UTC math on date-only is safe). */
function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Cap a bullet list at MAX_LIST_LINES lines, folding overflow into '…and K more'. */
function capLines(lines: string[]): string[] {
  if (lines.length <= MAX_LIST_LINES) return lines;
  const shown = lines.slice(0, MAX_LIST_LINES - 1);
  return [...shown, `…and ${lines.length - shown.length} more`];
}

/** '• title — owner (due Thu 16 Jul)' — owner and date parts drop out when absent. */
function taskLine(t: TaskRow): string {
  const owner = t.owner_name?.trim() ? ` — ${t.owner_name.trim()}` : "";
  const due = t.due_date ? ` (due ${fmtDay(t.due_date)})` : "";
  return `• ${t.title}${owner}${due}`;
}

// ---------------------------------------------------------------------------
// Defensive query wrapper — missing table / RLS surprise / network error all
// collapse to null, which callers treat as "omit this section".
// ---------------------------------------------------------------------------
async function safeRows<T>(
  q: PromiseLike<{ data: unknown; error: unknown }>
): Promise<T[] | null> {
  try {
    const { data, error } = await q;
    if (error) return null;
    return (data ?? []) as T[];
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// buildDigest
// ---------------------------------------------------------------------------
export async function buildDigest(): Promise<Digest> {
  const sb = createAdminSupabaseClient();
  const now = new Date();
  const generatedAt = now.toISOString();
  const today = istDateString(now); // IST 'YYYY-MM-DD'
  const weekEnd = addDays(today, 7);

  const header = `*Varnam Vizha — Daily Digest* · ${fmtHeaderDate(now)}`;
  const footer = `Full picture → ${DASHBOARD_URL}`;

  // Current edition: status='live' first, latest year as fallback.
  const edCols = "id, year, start_date, end_date";
  let edition =
    (
      await safeRows<EditionRow>(
        sb
          .schema("yi_connect")
          .from("festival_editions")
          .select(edCols)
          .eq("festival_key", FESTIVAL_KEY)
          .eq("status", "live")
          .order("year", { ascending: false })
          .limit(1)
      )
    )?.[0] ?? null;
  if (!edition) {
    edition =
      (
        await safeRows<EditionRow>(
          sb
            .schema("yi_connect")
            .from("festival_editions")
            .select(edCols)
            .eq("festival_key", FESTIVAL_KEY)
            .order("year", { ascending: false })
            .limit(1)
        )
      )?.[0] ?? null;
  }

  if (!edition) {
    return {
      text: [
        header,
        "No festival edition is set up yet — nothing to report today.",
        footer,
      ].join("\n\n"),
      generatedAt,
    };
  }

  // Edition events (small set; filtered in JS for the 7-day window).
  const events =
    (await safeRows<EventRow>(
      sb
        .schema("yi_connect")
        .from("events")
        .select("id, title, start_date, status")
        .eq("festival_edition_id", edition.id)
    )) ?? [];
  const eventIds = events.map((e) => e.id);

  // Fire the independent reads in parallel.
  const [overdueTasks, weekTasks, milestones, permissions, regCounts] =
    await Promise.all([
      // ⚠️ Overdue open follow-ups.
      safeRows<TaskRow>(
        sb
          .schema("yi_connect")
          .from("varnam_tasks")
          .select("title, owner_name, due_date")
          .eq("edition_id", edition.id)
          .eq("kind", "task")
          .eq("status", "open")
          .lt("due_date", today)
          .order("due_date", { ascending: true })
      ),
      // 📌 Open follow-ups due in the next 7 days (incl. today).
      safeRows<TaskRow>(
        sb
          .schema("yi_connect")
          .from("varnam_tasks")
          .select("title, owner_name, due_date")
          .eq("edition_id", edition.id)
          .eq("kind", "task")
          .eq("status", "open")
          .gte("due_date", today)
          .lte("due_date", weekEnd)
          .order("due_date", { ascending: true })
      ),
      // 🗓️ Next open milestone.
      safeRows<TaskRow>(
        sb
          .schema("yi_connect")
          .from("varnam_tasks")
          .select("title, owner_name, due_date")
          .eq("edition_id", edition.id)
          .eq("kind", "milestone")
          .eq("status", "open")
          .gte("due_date", today)
          .order("due_date", { ascending: true })
          .limit(1)
      ),
      // 📋 Permission letters across this edition's events.
      eventIds.length
        ? safeRows<PermissionRow>(
            sb
              .schema("yi_connect")
              .from("varnam_permissions")
              .select("status")
              .in("event_id", eventIds)
          )
        : Promise.resolve<PermissionRow[] | null>(null),
      // 📝 Registration counts (total + last 24h), head-only for speed.
      (async () => {
        if (!eventIds.length) return null;
        try {
          const since = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
          const [total, last24h] = await Promise.all([
            sb
              .schema("yi_connect")
              .from("guest_rsvps")
              .select("id", { count: "exact", head: true })
              .in("event_id", eventIds),
            sb
              .schema("yi_connect")
              .from("guest_rsvps")
              .select("id", { count: "exact", head: true })
              .in("event_id", eventIds)
              .gte("created_at", since),
          ]);
          if (total.error || last24h.error) return null;
          return { total: total.count ?? 0, last24h: last24h.count ?? 0 };
        } catch {
          return null;
        }
      })(),
    ]);

  const sections: string[] = [header];

  // ⏳ Countdown to the festival.
  if (edition.start_date) {
    const dTo = daysUntilIst(edition.start_date, now);
    const dEnd = edition.end_date ? daysUntilIst(edition.end_date, now) : null;
    if (dTo > 0) sections.push(`⏳ D-${dTo} days to the festival`);
    else if (dTo === 0) sections.push("⏳ The festival starts *today*!");
    else if (dEnd !== null && dEnd >= 0)
      sections.push("⏳ The festival is on — day by day, we're live!");
    // Past editions: no countdown line.
  }

  // ⚠️ Overdue follow-ups.
  if (overdueTasks && overdueTasks.length > 0) {
    sections.push(
      ["⚠️ *Overdue follow-ups*", ...capLines(overdueTasks.map(taskLine))].join(
        "\n"
      )
    );
  }

  // 📌 Due this week.
  if (weekTasks && weekTasks.length > 0) {
    sections.push(
      ["📌 *Due this week*", ...capLines(weekTasks.map(taskLine))].join("\n")
    );
  }

  // 🗓️ Next milestone.
  const milestone = milestones?.[0];
  if (milestone) {
    const when = milestone.due_date ? ` (${fmtDay(milestone.due_date)})` : "";
    sections.push(`🗓️ Next milestone: ${milestone.title}${when}`);
  }

  // 📋 Permissions progress.
  if (permissions && permissions.length > 0) {
    const approved = permissions.filter((p) => p.status === "approved").length;
    sections.push(`📋 Permissions: ${approved} of ${permissions.length} approved`);
  }

  // 📝 Registration momentum.
  if (regCounts && regCounts.total > 0) {
    sections.push(
      `📝 Registrations: +${regCounts.last24h} in the last 24h · total ${regCounts.total} across the edition`
    );
  }

  // 🎪 Events in the next 7 days.
  const nowMs = now.getTime();
  const weekMs = nowMs + 7 * 86_400_000;
  const upcoming = events
    .filter((e) => {
      if (!e.start_date || e.status === "cancelled") return false;
      const t = new Date(e.start_date).getTime();
      return !Number.isNaN(t) && t >= nowMs && t <= weekMs;
    })
    .sort(
      (a, b) =>
        new Date(a.start_date as string).getTime() -
        new Date(b.start_date as string).getTime()
    );
  if (upcoming.length > 0) {
    sections.push(
      [
        "🎪 *Events in the next 7 days*",
        ...capLines(
          upcoming.map((e) => `• ${e.title} (${fmtDay(e.start_date as string)})`)
        ),
      ].join("\n")
    );
  }

  sections.push(footer);

  return { text: sections.join("\n\n"), generatedAt };
}
