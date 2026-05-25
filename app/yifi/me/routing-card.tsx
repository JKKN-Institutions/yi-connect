"use client";

interface Match {
  id: string;
  match_reason: string | null;
  slot_time: string | null;
  table_number: number | null;
  is_walkup: boolean;
  meeting_happened: boolean;
  matched_person: {
    id: string;
    full_name: string;
    organisation: string | null;
    city: string | null;
    sector: string | null;
    photo_url: string | null;
    phone: string | null;
  } | null;
}

interface ScheduledSlot {
  time: string;
  person_name: string;
  table: number | null;
}

interface RoutingCardProps {
  matches: Match[];
  scheduledSlots: ScheduledSlot[];
}

export function RoutingCard({ matches, scheduledSlots }: RoutingCardProps) {
  return (
    <div className="space-y-4">
      {/* Scheduled slots */}
      {scheduledSlots.length > 0 && (
        <div className="bg-[#229434]/10 border border-[#229434]/30 rounded-xl p-4">
          <h3 className="text-[#229434] font-medium text-sm uppercase tracking-wide mb-3">
            Scheduled Meetings
          </h3>
          <div className="space-y-2">
            {scheduledSlots.map((slot, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2"
              >
                <div>
                  <span className="text-white font-medium text-sm">{slot.person_name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-white/50">
                  <span>
                    {new Date(slot.time).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {slot.table && <span>Table {slot.table}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All matches */}
      <div className="space-y-3">
        {matches.map((match, i) => (
          <div
            key={match.id}
            className={`bg-white/5 border rounded-xl p-4 transition-colors ${
              match.meeting_happened
                ? "border-[#229434]/30 bg-[#229434]/5"
                : "border-white/10 hover:border-white/20"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FD7215]/20 flex items-center justify-center text-white font-bold text-sm">
                  {match.matched_person?.full_name?.charAt(0) ?? (i + 1)}
                </div>
                <div>
                  <p className="text-white font-medium text-sm">
                    {match.matched_person?.full_name ?? "TBA"}
                  </p>
                  <p className="text-white/50 text-xs">
                    {[match.matched_person?.organisation, match.matched_person?.city]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>
              {match.meeting_happened && (
                <span className="text-[#229434] text-xs font-medium">Met ✓</span>
              )}
              {match.is_walkup && !match.meeting_happened && (
                <span className="text-white/30 text-xs">Walk-up</span>
              )}
            </div>
            {match.match_reason && (
              <p className="text-white/40 text-xs mt-2 pl-13">
                {match.match_reason}
              </p>
            )}
            {match.matched_person?.phone && (
              <a
                href={`tel:${match.matched_person.phone}`}
                className="text-[#FD7215] text-xs mt-1 pl-13 inline-block hover:underline"
              >
                {match.matched_person.phone}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
