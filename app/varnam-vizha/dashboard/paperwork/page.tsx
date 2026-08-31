import type { Metadata } from "next";
import Link from "next/link";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";
import { getCurrentEdition } from "@/lib/varnam/data/editions";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { AUTHORITIES } from "@/lib/varnam/letters";
import {
  CollectorateCsvButton,
  type CollectorateRow,
} from "./CollectorateCsvButton";

export const metadata: Metadata = { title: "Paperwork" };

type EventRow = CollectorateRow & { id: string };

type PermissionCell = { authority: string; status: string };

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        timeZone: "Asia/Kolkata",
      })
    : "—";

/** Dot colour per status: needed=grey, drafted=marigold, submitted=teal, approved=green. */
function dotColor(status: string): string {
  switch (status) {
    case "drafted":
      return "bg-[#F4A300]";
    case "submitted":
      return "bg-[#0CA4A5]";
    case "approved":
      return "bg-[#0a8485]";
    default: // needed
      return "bg-[#3B0A45]/20";
  }
}

const STATUS_LABEL: Record<string, string> = {
  needed: "Needed",
  drafted: "Drafted",
  submitted: "Submitted",
  approved: "Approved",
};

const AUTHORITY_SHORT: Record<string, string> = {
  collector: "Collector",
  police: "Police",
  corporation: "Corporation",
};

export default async function PaperworkPage() {
  const access = await getVarnamAccess();
  if (!access.canView) return <Forbidden403 reason={access.reason} />;

  const edition = await getCurrentEdition();
  const sb = createAdminSupabaseClient();

  let events: EventRow[] = [];
  if (edition) {
    const { data: eventsRaw } = await sb
      .schema("yi_connect")
      .from("events")
      .select(
        "id, title, start_date, end_date, venue_address, category, max_capacity, public_slug"
      )
      .eq("festival_edition_id", edition.id)
      .order("start_date", { ascending: true });
    events = (eventsRaw ?? []) as EventRow[];
  }

  // varnam_permissions is added by this round's migration — query defensively
  // (cast locally; treat an error/missing table as "no rows yet").
  const statusByEvent = new Map<string, Map<string, string>>();
  if (events.length > 0) {
    const { data: permsRaw } = await sb
      .schema("yi_connect")
      .from("varnam_permissions")
      .select("event_id, authority, status")
      .in(
        "event_id",
        events.map((e) => e.id)
      );
    for (const p of (permsRaw ?? []) as (PermissionCell & {
      event_id: string;
    })[]) {
      const m = statusByEvent.get(p.event_id) ?? new Map<string, string>();
      m.set(p.authority, p.status);
      statusByEvent.set(p.event_id, m);
    }
  }

  const totalNeeded = events.length * AUTHORITIES.length;
  let approvedCount = 0;
  for (const e of events) {
    const m = statusByEvent.get(e.id);
    for (const a of AUTHORITIES) {
      if (m?.get(a.key) === "approved") approvedCount++;
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45]">
            Paperwork
          </h1>
          <p className="mt-1 text-sm text-[#2B0A33]/60">
            Permission letters for every event, at a glance —{" "}
            <span className="font-semibold text-[#3B0A45]">
              {approvedCount} of {totalNeeded} approvals in hand
            </span>
            .
          </p>
        </div>
        <CollectorateCsvButton rows={events} />
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[#2B0A33]/60">
        {(["needed", "drafted", "submitted", "approved"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span
              className={`inline-block size-2.5 rounded-full ${dotColor(s)}`}
            />
            {STATUS_LABEL[s]}
          </span>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#3B0A45]/10 bg-white shadow-sm">
        {events.length === 0 ? (
          <p className="p-6 text-sm text-[#2B0A33]/50">
            No events on this edition yet — add events first, then track their
            permission letters here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#3B0A45]/10 text-xs uppercase tracking-wide text-[#2B0A33]/50">
                  <th className="px-4 py-3 font-semibold">Event</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  {AUTHORITIES.map((a) => (
                    <th
                      key={a.key}
                      className="px-4 py-3 text-center font-semibold"
                    >
                      {AUTHORITY_SHORT[a.key] ?? a.key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const m = statusByEvent.get(e.id);
                  return (
                    <tr
                      key={e.id}
                      className="border-b border-[#3B0A45]/6 last:border-0 hover:bg-[#FFF9F0]"
                    >
                      <td className="px-4 py-3">
                        {access.canManage ? (
                          <Link
                            href={`/varnam-vizha/dashboard/events/${e.id}/permissions`}
                            className="font-medium text-[#2B0A33] hover:text-[#D6336C] hover:underline"
                          >
                            {e.title}
                          </Link>
                        ) : (
                          <span className="font-medium text-[#2B0A33]">
                            {e.title}
                          </span>
                        )}
                        {e.venue_address ? (
                          <span className="mt-0.5 block truncate text-xs text-[#2B0A33]/45">
                            {e.venue_address}
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[#2B0A33]/70">
                        {fmtDate(e.start_date)}
                      </td>
                      {AUTHORITIES.map((a) => {
                        const status = m?.get(a.key) ?? "needed";
                        return (
                          <td key={a.key} className="px-4 py-3 text-center">
                            <span
                              title={`${a.name}: ${STATUS_LABEL[status] ?? status}`}
                              className={`inline-block size-3 rounded-full ${dotColor(status)}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {access.canManage && events.length > 0 && (
        <p className="mt-4 text-xs text-[#2B0A33]/50">
          Click an event to draft its letters and update statuses.
        </p>
      )}
    </div>
  );
}
