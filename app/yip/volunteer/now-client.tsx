"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getVolunteerAgendaNow,
  type AgendaNow,
} from "@/app/yip/actions/volunteer-desk";

export function NowCard({ eventId }: { eventId: string }) {
  const [now, setNow] = useState<AgendaNow | null>(null);

  const refresh = useCallback(async () => {
    const r = await getVolunteerAgendaNow(eventId);
    if (r.success) setNow(r.data);
  }, [eventId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000); // matches the kiosk LIST cadence
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <section className="rounded-2xl border border-[#1a1a3e]/8 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[#FF9933]">
        Happening Now
      </h2>
      {!now?.item ? (
        <p className="mt-3 text-base text-[#1a1a3e]/55">
          {now?.eventStatus && now.eventStatus.includes("live")
            ? "Between sessions — stand by."
            : "The session hasn't started yet."}
        </p>
      ) : (
        <div className="mt-3">
          <p className="text-xl font-black text-[#1a1a3e]">{now.item.title}</p>
          {now.item.description && (
            <p className="mt-1 text-sm text-[#1a1a3e]/60">
              {now.item.description}
            </p>
          )}
          {now.item.day && (
            <span className="mt-3 inline-block rounded-full bg-[#FF9933]/10 px-3 py-1 text-xs font-semibold text-[#FF9933]">
              Day {now.item.day}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
