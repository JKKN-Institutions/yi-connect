/**
 * YIP Chapter Round Report — Section 2: Chief Guests & Jury.
 *
 * Self-fetching server component (component contract — see _sections/Overview.tsx):
 *   - default-exported async RSC, signature ({ eventId, canManage }).
 *   - fetches its OWN data via lib/yip/report/sections/guests-jury.ts.
 *   - renders the printable block; when canManage, renders the inline
 *     "use client" capture child (GuestsJuryFill) so the organiser can add /
 *     edit chief guests and mark the valedictory guest (print:hidden).
 *   - returns null (renders nothing) when the data getter returns null.
 *
 * Renders:
 *   1. Chief Guests — name, designation, organization.
 *   2. Guest at the Valedictory Session — the guest(s) flagged is_valedictory.
 *   3. Jury Details per Session — one block per scored agenda session listing
 *      the jurors assigned to it.
 */
import { getGuestsJuryData } from "@/lib/yip/report/sections/guests-jury";
import { GuestsJuryFill } from "./GuestsJuryFill";

/** Day N · Session N label for a scored agenda row. */
function sessionLabel(day: number, sequenceOrder: number): string {
  const parts: string[] = [];
  if (day > 0) parts.push(`Day ${day}`);
  parts.push(`Session ${sequenceOrder > 0 ? sequenceOrder : "—"}`);
  return parts.join(" · ");
}

/** Render one guest as a print-clean line. */
function GuestLine({
  name,
  designation,
  organization,
}: {
  name: string;
  designation: string | null;
  organization: string | null;
}) {
  const sub = [designation, organization].filter(Boolean).join(", ");
  return (
    <div className="break-inside-avoid rounded-lg border border-[#1a1a3e]/8 bg-white px-3 py-2">
      <p className="text-sm font-medium text-[#1a1a3e]">{name}</p>
      {sub && <p className="text-xs text-[#1a1a3e]/55">{sub}</p>}
    </div>
  );
}

export default async function GuestsJurySection({
  eventId,
  canManage,
}: {
  eventId: string;
  canManage: boolean;
}) {
  const data = await getGuestsJuryData(eventId);
  if (!data) return null;

  const { chiefGuests, valedictoryGuests, sessions } = data;

  // Flat list for the capture child (chief + valedictory, in display order).
  const editableGuests = [...chiefGuests, ...valedictoryGuests]
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((g) => ({
      id: g.id,
      name: g.name,
      designation: g.designation,
      organization: g.organization,
      isValedictory: g.isValedictory,
    }));

  return (
    <div className="space-y-6">
      {/* ── Chief Guests ───────────────────────────────────────────── */}
      <div className="break-inside-avoid">
        <h3 className="mb-2 text-sm font-semibold text-[#1a1a3e]">
          Chief Guests
        </h3>
        {chiefGuests.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {chiefGuests.map((g) => (
              <GuestLine
                key={g.id}
                name={g.name}
                designation={g.designation}
                organization={g.organization}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#1a1a3e]/40">
            {canManage
              ? "No chief guests recorded yet — add them below."
              : "No chief guests recorded."}
          </p>
        )}
      </div>

      {/* ── Valedictory Session Guest ──────────────────────────────── */}
      <div className="break-inside-avoid">
        <h3 className="mb-2 text-sm font-semibold text-[#1a1a3e]">
          Guest at the Valedictory Session
        </h3>
        {valedictoryGuests.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {valedictoryGuests.map((g) => (
              <GuestLine
                key={g.id}
                name={g.name}
                designation={g.designation}
                organization={g.organization}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#1a1a3e]/40">
            {canManage
              ? "Not recorded — mark a guest as the valedictory guest below."
              : "Not recorded."}
          </p>
        )}
      </div>

      {/* ── Inline capture (canManage only, hidden in print) ──────────── */}
      {canManage && (
        <GuestsJuryFill eventId={eventId} guests={editableGuests} />
      )}

      {/* ── Jury Details per Session ───────────────────────────────── */}
      <div className="break-inside-avoid">
        <h3 className="mb-2 text-sm font-semibold text-[#1a1a3e]">
          Jury Details per Session
        </h3>
        {sessions.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-[#1a1a3e]/8">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#1a1a3e]/[0.03] text-left">
                  <th className="w-1/3 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[#1a1a3e]/50">
                    Session
                  </th>
                  <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[#1a1a3e]/50">
                    Jury Panel
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr
                    key={s.agendaItemId}
                    className="break-inside-avoid border-t border-[#1a1a3e]/8 align-top"
                  >
                    <td className="px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#FF9933]">
                        {sessionLabel(s.day, s.sequenceOrder)}
                      </p>
                      <p className="text-sm text-[#1a1a3e]">{s.title || "—"}</p>
                    </td>
                    <td className="px-3 py-2">
                      {s.jurors.length > 0 ? (
                        <ul className="flex flex-wrap gap-1.5">
                          {s.jurors.map((j, i) => (
                            <li
                              key={`${j.name}-${i}`}
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
                                j.isActive
                                  ? "bg-[#138808]/10 text-[#138808]"
                                  : "bg-[#1a1a3e]/5 text-[#1a1a3e]/45 line-through"
                              }`}
                            >
                              {j.name}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs text-[#1a1a3e]/40">
                          No jurors assigned
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[#1a1a3e]/40">
            No scored sessions configured for this event.
          </p>
        )}
      </div>
    </div>
  );
}
