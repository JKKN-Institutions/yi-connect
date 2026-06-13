"use client";

import { useState } from "react";
import { KioskClient } from "./kiosk-client";
import { DeskCard } from "./desk-client";
import { NowCard } from "./now-client";
import { DeskRoster } from "./roster-client";

type Tab = "desk" | "now" | "roster" | "vote";
const SAFFRON = "#FF9933";

const TABS: [Tab, string][] = [
  ["desk", "Desk"],
  ["now", "Now"],
  ["roster", "Students"],
  ["vote", "Vote"],
];

export function VolunteerDashboard({
  eventId,
  volunteerName,
}: {
  eventId: string;
  volunteerName: string;
}) {
  const [tab, setTab] = useState<Tab>("desk");

  return (
    <div className="space-y-4">
      {tab === "desk" && <DeskCard eventId={eventId} />}
      {tab === "now" && <NowCard eventId={eventId} />}
      {tab === "roster" && <DeskRoster eventId={eventId} />}
      {tab === "vote" && (
        <KioskClient eventId={eventId} volunteerName={volunteerName} />
      )}

      {/* Bottom tab bar — thumb-reachable on a phone */}
      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-md border-t border-[#1a1a3e]/10 bg-white">
        {TABS.map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="flex flex-1 flex-col items-center gap-0.5 py-3 text-xs font-semibold transition-colors"
            style={{ color: tab === t ? SAFFRON : "#1a1a3e80" }}
          >
            {label}
          </button>
        ))}
      </nav>
      {/* spacer so content clears the fixed bar */}
      <div className="h-16" />
    </div>
  );
}
