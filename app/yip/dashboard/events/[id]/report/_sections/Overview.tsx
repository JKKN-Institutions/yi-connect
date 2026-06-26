/**
 * YIP Chapter Round Report — Section 1: Event Overview.
 *
 * REFERENCE section component. Every report section copies this contract
 * EXACTLY:
 *   - default-exported async server component (no "use client" here — it's a
 *     React Server Component; interactivity lives in a "use client" child).
 *   - signature: ({ eventId, canManage }: { eventId: string; canManage: boolean }).
 *   - fetches its OWN data via the matching lib/yip/report/sections/<kebab>.ts
 *     getter — the page never passes data in.
 *   - renders the printable report block; when canManage && a fill-in field is
 *     empty, renders the inline "use client" capture control (print:hidden).
 *   - returns null (renders nothing) when the data getter returns null, so a
 *     no-access / missing event never throws inside the page's Suspense.
 */
import { getOverviewData } from "@/lib/yip/report/sections/overview";
import { OverviewOathFill } from "./OverviewOathFill";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function levelLabel(level: string): string {
  const map: Record<string, string> = {
    chapter: "Chapter Round",
    regional: "Regional Round",
    national: "National Round",
  };
  return map[level] ?? level;
}

/** Small labelled field used across the report's fact rows. */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="break-inside-avoid">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1a1a3e]/40">
        {label}
      </p>
      <div className="mt-0.5 text-sm text-[#1a1a3e]">{children}</div>
    </div>
  );
}

export default async function OverviewSection({
  eventId,
  canManage,
}: {
  eventId: string;
  canManage: boolean;
}) {
  const data = await getOverviewData(eventId);
  if (!data) return null;

  const location = [data.city, data.state].filter(Boolean).join(", ");

  return (
    <div className="space-y-6">
      {/* Headline facts */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Chapter">
          {data.chapterName ?? "—"}
          {data.zone ? (
            <span className="text-[#1a1a3e]/50"> · {data.zone} Zone</span>
          ) : null}
        </Field>
        <Field label="Round">{levelLabel(data.level)}</Field>
        <Field label="Day 1">{formatDate(data.day1Date)}</Field>
        <Field label="Day 2">{formatDate(data.day2Date)}</Field>
        <Field label="Venue">
          {data.venueName ?? "—"}
          {data.venueAddress ? (
            <span className="block text-[#1a1a3e]/55">{data.venueAddress}</span>
          ) : null}
        </Field>
        <Field label="Location">{location || "—"}</Field>
        <Field label="Delegates">{data.participantCount}</Field>
        <Field label="Results Published">
          {data.resultsPublishedAt ? formatDate(data.resultsPublishedAt) : "Not yet"}
        </Field>
      </div>

      {/* Parliamentary oath — Bucket-A fill-in when empty */}
      <div className="break-inside-avoid">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1a1a3e]/40">
          Parliamentary Oath
        </p>
        {data.oathText ? (
          <blockquote className="mt-1 border-l-[3px] border-l-[#FF9933] bg-[#FF9933]/5 px-4 py-2 text-sm italic text-[#1a1a3e]/80">
            {data.oathText}
          </blockquote>
        ) : canManage ? (
          <div className="mt-1">
            <p className="text-sm text-[#1a1a3e]/40">Not recorded.</p>
            <OverviewOathFill eventId={eventId} initialValue="" />
          </div>
        ) : (
          <p className="mt-1 text-sm text-[#1a1a3e]/40">Not recorded.</p>
        )}
      </div>

      {/* Chapter Leadership (from yi_directory) */}
      <div className="break-inside-avoid">
        <h3 className="mb-2 text-sm font-semibold text-[#1a1a3e]">
          Chapter Leadership
        </h3>
        {data.chapterLeaders.length > 0 ? (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {data.chapterLeaders.map((p, i) => (
              <li
                key={`${p.email ?? p.name}-${i}`}
                className="flex items-baseline justify-between gap-3 rounded-lg border border-[#1a1a3e]/8 bg-white px-3 py-2"
              >
                <span className="text-sm font-medium text-[#1a1a3e]">
                  {p.name}
                </span>
                <span className="shrink-0 text-xs text-[#1a1a3e]/55">
                  {p.title ?? p.role}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#1a1a3e]/40">
            No chapter leadership recorded in the Yi directory for this chapter.
          </p>
        )}
      </div>

      {/* YIP Moderator Team (from yip.organizers) */}
      <div className="break-inside-avoid">
        <h3 className="mb-2 text-sm font-semibold text-[#1a1a3e]">
          YIP Moderator Team
        </h3>
        {data.moderatorTeam.length > 0 ? (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {data.moderatorTeam.map((m, i) => (
              <li
                key={`${m.email ?? m.name}-${i}`}
                className="flex items-baseline justify-between gap-3 rounded-lg border border-[#1a1a3e]/8 bg-white px-3 py-2"
              >
                <span className="text-sm font-medium text-[#1a1a3e]">
                  {m.name}
                </span>
                <span className="shrink-0 text-xs text-[#1a1a3e]/55">
                  {m.role}
                  {m.zone ? ` · ${m.zone}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#1a1a3e]/40">
            No moderator team recorded for this event.
          </p>
        )}
      </div>
    </div>
  );
}
