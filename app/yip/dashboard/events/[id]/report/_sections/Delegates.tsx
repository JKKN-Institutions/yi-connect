/**
 * YIP Chapter Round Report — Section 3: Delegates.
 *
 * Self-fetching React Server Component (component contract): default-exported
 * async function with the exact ({ eventId, canManage }) signature. Fetches its
 * own data via getDelegatesData and returns null when that getter returns null
 * (no access / missing event) so a no-access section never throws inside the
 * page's <Suspense>.
 *
 * This section is fully auto-derived — there are NO inline fill-in controls, so
 * `canManage` is accepted (per the contract) but not used for capture. It IS
 * used to decide whether to surface the operational PII-purge warning, which is
 * only actionable by an organiser.
 *
 * Renders:
 *   - Stat tiles: Registered / Attended / Schools.
 *   - Day-1 vs Day-2 attendance breakdown.
 *   - The list of participating schools (with delegate counts).
 *   - A note that school PII is purged after the event (events.pii_purged_at),
 *     so the report must be generated before the purge.
 */
import { AlertTriangle } from "lucide-react";
import { getDelegatesData } from "@/lib/yip/report/sections/delegates";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Big headline stat tile used at the top of the section. */
function StatTile({
  value,
  label,
  sub,
}: {
  value: number | string;
  label: string;
  sub?: string;
}) {
  return (
    <div className="break-inside-avoid rounded-xl border border-[#1a1a3e]/8 bg-white px-4 py-3">
      <p className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[#1a1a3e]">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#1a1a3e]/45">
        {label}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-[#1a1a3e]/55">{sub}</p> : null}
    </div>
  );
}

export default async function DelegatesSection({
  eventId,
  canManage,
}: {
  eventId: string;
  canManage: boolean;
}) {
  const data = await getDelegatesData(eventId);
  if (!data) return null;

  const attendancePct =
    data.registeredCount > 0
      ? Math.round((data.attendedCount / data.registeredCount) * 100)
      : 0;

  const purged = Boolean(data.piiPurgedAt);

  return (
    <div className="space-y-6">
      {/* Headline stat tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile value={data.registeredCount} label="Registered Delegates" />
        <StatTile
          value={data.attendedCount}
          label="Attended"
          sub={
            data.registeredCount > 0
              ? `${attendancePct}% of registered`
              : undefined
          }
        />
        <StatTile
          value={purged ? "—" : data.schoolCount}
          label="Participating Schools"
        />
      </div>

      {/* Day-by-day attendance breakdown */}
      <div className="break-inside-avoid">
        <h3 className="mb-2 text-sm font-semibold text-[#1a1a3e]">
          Attendance by Day
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="flex items-baseline justify-between gap-3 rounded-lg border border-[#1a1a3e]/8 bg-white px-3 py-2">
            <span className="text-sm font-medium text-[#1a1a3e]">Day 1</span>
            <span className="text-sm text-[#1a1a3e]/70">
              {data.attendedDay1} checked in
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3 rounded-lg border border-[#1a1a3e]/8 bg-white px-3 py-2">
            <span className="text-sm font-medium text-[#1a1a3e]">Day 2</span>
            <span className="text-sm text-[#1a1a3e]/70">
              {data.attendedDay2} checked in
            </span>
          </div>
        </div>
      </div>

      {/* Participating schools */}
      <div className="break-inside-avoid">
        <h3 className="mb-2 text-sm font-semibold text-[#1a1a3e]">
          Participating Schools
          {!purged && data.schoolCount > 0 ? (
            <span className="ml-2 text-xs font-normal text-[#1a1a3e]/50">
              ({data.schoolCount})
            </span>
          ) : null}
        </h3>

        {purged ? (
          <p className="text-sm text-[#1a1a3e]/40">
            School details were purged after the event
            {data.piiPurgedAt ? ` on ${formatDate(data.piiPurgedAt)}` : ""} and
            are no longer available.
          </p>
        ) : data.schools.length > 0 ? (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {data.schools.map((s, i) => (
              <li
                key={`${s.name}-${i}`}
                className="flex items-baseline justify-between gap-3 rounded-lg border border-[#1a1a3e]/8 bg-white px-3 py-2"
              >
                <span className="text-sm font-medium text-[#1a1a3e]">
                  {s.name}
                </span>
                <span className="shrink-0 text-xs text-[#1a1a3e]/55">
                  {s.delegates}
                  {s.delegates === 1 ? " delegate" : " delegates"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#1a1a3e]/40">
            No schools recorded for this event.
          </p>
        )}
      </div>

      {/* PII-purge operational note. Always shown to organisers (canManage) as a
          standing reminder; shown to viewers only once a purge has happened so
          they understand why school data may be missing. */}
      {!purged && canManage ? (
        <div className="print:hidden break-inside-avoid flex items-start gap-2 rounded-lg border border-[#FF9933]/30 bg-[#FF9933]/5 px-3 py-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#FF9933]" />
          <p className="text-xs text-[#1a1a3e]/70">
            School names are personal data and are purged after the event. Save
            or print this report <strong>before</strong> the purge to keep the
            participating-schools list on record.
          </p>
        </div>
      ) : null}
    </div>
  );
}
