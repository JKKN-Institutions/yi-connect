import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { PrintButton } from "./_components/PrintButton";
import { RosterSection, type RosterRow } from "./_components/RosterSection";

export const metadata: Metadata = { title: "Run sheet" };

type Params = { params: Promise<{ id: string }> };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Checklist rows come from yi_connect.varnam_tasks (owned by the Tasks
 * module) — cast defensively and degrade to an empty list on any error. */
type ChecklistItem = {
  id: string;
  title: string;
  status: string | null;
  owner_name: string | null;
  due_date: string | null;
};

const fmtDateTimeIST = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      })
    : "—";

const fmtDateIST = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        timeZone: "Asia/Kolkata",
      })
    : null;

function statusChip(status: string | null): string {
  switch (status) {
    case "published":
      return "bg-[#0CA4A5]/10 text-[#0a8485]";
    case "cancelled":
      return "bg-[#D6336C]/10 text-[#b02a59]";
    default:
      return "bg-[#3B0A45]/8 text-[#3B0A45]/70";
  }
}

/** Print stylesheet: hide the site chrome + interactive bits, compact the
 * tables — what prints is a clean one-page(ish) run sheet. */
const PRINT_CSS = `
@media print {
  header, footer, nav, .vv-no-print { display: none !important; }
  body { background: #fff !important; }
  .vv-runsheet { max-width: none !important; padding: 0 !important; }
  .vv-runsheet section { box-shadow: none !important; break-inside: avoid; }
  .vv-runsheet table { font-size: 11px; }
  .vv-runsheet th, .vv-runsheet td { padding: 4px 8px !important; }
  .vv-runsheet a { color: inherit !important; text-decoration: none !important; }
}
`;

export default async function RunSheetPage({ params }: Params) {
  const { id } = await params;
  const access = await getVarnamAccess();
  if (!access.canView) return <Forbidden403 reason={access.reason} />;

  if (!UUID_RE.test(id)) notFound();
  const sb = createAdminSupabaseClient();

  const { data: eventRaw } = await sb
    .schema("yi_connect")
    .from("events")
    .select(
      "id, title, status, start_date, end_date, venue_address, festival_edition_id"
    )
    .eq("id", id)
    .maybeSingle();
  const event = eventRaw as {
    id: string;
    title: string;
    status: string | null;
    start_date: string | null;
    end_date: string | null;
    venue_address: string | null;
    festival_edition_id: string | null;
  } | null;
  if (!event || !event.festival_edition_id) notFound();

  // Roster + registration snapshot + checklist, in parallel.
  const [rosterRes, confirmedRes, waitlistRes, checkedInRes] =
    await Promise.all([
      sb
        .schema("yi_connect")
        .from("varnam_event_roster")
        .select("id, person_name, phone, duty, station, notes")
        .eq("event_id", event.id)
        .order("sort", { ascending: true })
        .order("created_at", { ascending: true }),
      sb
        .schema("yi_connect")
        .from("guest_rsvps")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("status", "confirmed"),
      sb
        .schema("yi_connect")
        .from("guest_rsvps")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("status", "waitlist"),
      sb
        .schema("yi_connect")
        .from("guest_rsvps")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id)
        .not("checked_in_at", "is", null),
    ]);
  const roster = (rosterRes.data ?? []) as RosterRow[];
  const confirmed = confirmedRes.count ?? 0;
  const waitlist = waitlistRes.count ?? 0;
  const checkedIn = checkedInRes.count ?? 0;

  // Checklist from varnam_tasks (another module's table) — read defensively:
  // if the query errors for any reason, show the empty state, never crash.
  let checklist: ChecklistItem[] = [];
  try {
    const { data, error } = await sb
      .schema("yi_connect")
      .from("varnam_tasks")
      .select("id, title, status, owner_name, due_date")
      .eq("event_id", event.id)
      .order("due_date", { ascending: true });
    if (!error) checklist = (data ?? []) as ChecklistItem[];
  } catch {
    checklist = [];
  }

  const snapshot = [
    { label: "Confirmed", value: confirmed },
    { label: "Waitlist", value: waitlist },
    { label: "Checked in", value: checkedIn },
  ];

  return (
    <div className="vv-runsheet mx-auto max-w-4xl px-4 py-10">
      <style>{PRINT_CSS}</style>

      <Link
        href="/varnam-vizha/dashboard/events"
        className="vv-no-print text-sm font-medium text-[#0CA4A5] hover:underline"
      >
        ← All events
      </Link>

      {/* ── Event header ──────────────────────────────────────────────── */}
      <div className="mt-4 mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#D6336C]">
            Run sheet
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45]">
            {event.title}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#2B0A33]/70">
            <span>{fmtDateTimeIST(event.start_date)}</span>
            {event.venue_address ? <span>· {event.venue_address}</span> : null}
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${statusChip(
                event.status
              )}`}
            >
              {event.status ?? "draft"}
            </span>
          </p>
        </div>
        <PrintButton />
      </div>

      {/* ── Registration snapshot ─────────────────────────────────────── */}
      <section className="mb-8 grid grid-cols-3 gap-3">
        {snapshot.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-[#3B0A45]/10 bg-white p-4 text-center shadow-sm"
          >
            <p className="font-[family-name:var(--font-vv-display)] text-2xl font-bold text-[#3B0A45]">
              {s.value}
            </p>
            <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-[#2B0A33]/50">
              {s.label}
            </p>
          </div>
        ))}
      </section>

      {/* ── Volunteer roster ──────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 font-[family-name:var(--font-vv-display)] text-xl font-bold text-[#3B0A45]">
          Volunteer roster
        </h2>
        <RosterSection
          eventId={event.id}
          rows={roster}
          canManage={access.canManage}
        />
      </section>

      {/* ── Checklist (read-only view of Tasks) ───────────────────────── */}
      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-[family-name:var(--font-vv-display)] text-xl font-bold text-[#3B0A45]">
            Checklist
          </h2>
          <Link
            href="/varnam-vizha/dashboard/tasks"
            className="vv-no-print text-sm font-medium text-[#0CA4A5] hover:underline"
          >
            Manage in Tasks →
          </Link>
        </div>
        <div className="rounded-2xl border border-[#3B0A45]/10 bg-white shadow-sm">
          {checklist.length === 0 ? (
            <p className="p-6 text-sm text-[#2B0A33]/50">
              No checklist items yet.
            </p>
          ) : (
            <ul className="divide-y divide-[#3B0A45]/6">
              {checklist.map((item) => {
                const done = item.status === "done";
                return (
                  <li
                    key={item.id}
                    className="flex items-start gap-3 px-4 py-3"
                  >
                    <span
                      aria-hidden
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        done
                          ? "bg-[#0CA4A5] text-white"
                          : "border border-[#3B0A45]/25 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          done
                            ? "text-[#2B0A33]/45 line-through"
                            : "text-[#2B0A33]"
                        }`}
                      >
                        {item.title}
                      </p>
                      {(item.owner_name || item.due_date) && (
                        <p className="mt-0.5 text-xs text-[#2B0A33]/50">
                          {item.owner_name ?? ""}
                          {item.owner_name && item.due_date ? " · " : ""}
                          {item.due_date
                            ? `due ${fmtDateIST(item.due_date)}`
                            : ""}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ── Key contacts ──────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 font-[family-name:var(--font-vv-display)] text-xl font-bold text-[#3B0A45]">
          Key contacts
        </h2>
        <div className="rounded-2xl border border-[#3B0A45]/10 bg-white p-5 shadow-sm">
          <dl className="space-y-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="font-medium text-[#2B0A33]">
                Chair, Varnam Vizha
              </dt>
              <dd className="text-[#2B0A33]/50">
                Add the chair&apos;s number to the roster above so it prints
                here on event day.
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <dt className="font-medium text-[#2B0A33]">Festival desk</dt>
              <dd>
                <a
                  href="mailto:erodevarnamvizha@gmail.com"
                  className="font-medium text-[#0CA4A5] hover:underline"
                >
                  erodevarnamvizha@gmail.com
                </a>
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}
