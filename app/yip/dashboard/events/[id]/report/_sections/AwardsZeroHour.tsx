/**
 * YIP Chapter Round Report — Section 5/6: Awards & Zero Hour.
 *
 * Self-fetching server component (contract per the architect's Overview.tsx):
 *   - default-exported async server component (no "use client" here;
 *     interactivity lives in the AwardsZeroHourFill "use client" child).
 *   - signature: ({ eventId, canManage }: { eventId: string; canManage: boolean }).
 *   - fetches its OWN data via lib/yip/report/sections/awards-zero-hour.ts.
 *   - returns null when the getter returns null (no-access / missing event), so
 *     it never throws inside the page's Suspense.
 *
 * Renders:
 *   - Awards & Recognitions: each award label with its winner name(s), derived
 *     from the stored results rows.
 *   - Zero Hour: the saved summary as report prose; when empty + canManage, the
 *     inline capture control (pre-filled from questions + motions).
 */
import { getAwardsZeroHourData } from "@/lib/yip/report/sections/awards-zero-hour";
import { AwardsZeroHourFill } from "./AwardsZeroHourFill";

export default async function AwardsZeroHourSection({
  eventId,
  canManage,
}: {
  eventId: string;
  canManage: boolean;
}) {
  const data = await getAwardsZeroHourData(eventId);
  if (!data) return null;

  return (
    <div className="space-y-8">
      {/* ── Awards & Recognitions ──────────────────────────────────── */}
      <div className="break-inside-avoid">
        <h3 className="mb-3 text-sm font-semibold text-[#1a1a3e]">
          Awards &amp; Recognitions
          {data.awardeeCount > 0 ? (
            <span className="ml-2 font-normal text-[#1a1a3e]/50">
              {data.awardeeCount}{" "}
              {data.awardeeCount === 1 ? "awardee" : "awardees"}
            </span>
          ) : null}
        </h3>

        {data.awards.length > 0 ? (
          <ul className="space-y-2">
            {data.awards.map((a) => (
              <li
                key={a.award}
                className="break-inside-avoid rounded-lg border border-[#1a1a3e]/8 bg-white px-3 py-2"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#FF9933]">
                  {a.award}
                </p>
                <p className="mt-0.5 text-sm font-medium text-[#1a1a3e]">
                  {a.winners.length > 0 ? a.winners.join(", ") : "—"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#1a1a3e]/40">
            No awards recorded yet. Awards appear here once results are computed
            and award categories are assigned.
          </p>
        )}
      </div>

      {/* ── Zero Hour ──────────────────────────────────────────────── */}
      <div className="break-inside-avoid">
        <h3 className="mb-2 text-sm font-semibold text-[#1a1a3e]">Zero Hour</h3>

        {data.zeroHourSummary ? (
          <div className="whitespace-pre-line border-l-[3px] border-l-[#FF9933] bg-[#FF9933]/5 px-4 py-3 text-sm leading-relaxed text-[#1a1a3e]/85">
            {data.zeroHourSummary}
          </div>
        ) : canManage ? (
          <div className="mt-1">
            <p className="text-sm text-[#1a1a3e]/40">
              {data.hasZeroHourSources
                ? "Not recorded yet — a draft is ready from this event's questions and motions."
                : "Not recorded."}
            </p>
            <AwardsZeroHourFill
              eventId={eventId}
              draft={data.zeroHourDraft}
              hasSources={data.hasZeroHourSources}
            />
          </div>
        ) : (
          <p className="mt-1 text-sm text-[#1a1a3e]/40">Not recorded.</p>
        )}
      </div>
    </div>
  );
}
