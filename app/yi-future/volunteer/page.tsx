import Link from "next/link";
import { requireDeskVolunteer } from "@/lib/yi-future/auth/volunteer-session";
import { isCheckInStation, stationLabel } from "@/lib/yi-future/volunteers";
import { DeskClient } from "./desk-client";

/**
 * /yi-future/volunteer — the check-in desk.
 *
 * The gate runs on the SERVER so a volunteer whose code was revoked, paused or
 * deleted sees a sentence immediately, on first paint, with no spinner and no
 * redirect. A silent bounce to a landing page is what makes this class of
 * problem undiagnosable at a live desk ("I type my code, it sends me back").
 *
 * requireDeskVolunteer(false) here: a non-check-in station may LOOK at the
 * list; the write path (markDelegatePresent) enforces the station itself.
 */
export default async function VolunteerDeskPage() {
  const auth = await requireDeskVolunteer(false);

  if (!auth.ok) {
    return (
      <main className="min-h-screen bg-ivory flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white border border-navy/10 rounded-xl p-6 text-center">
          <div className="text-[10px] font-bold uppercase tracking-widest text-navy/40">
            Check-in Desk
          </div>
          <h1 className="mt-2 text-xl font-bold text-navy">
            {auth.reason === "no_session"
              ? "You are not signed in as a volunteer"
              : "This desk is not open for you"}
          </h1>
          <p className="mt-3 text-sm text-navy/70">{auth.error}</p>
          <Link
            href="/yi-future/access"
            className="mt-6 inline-block px-5 py-3 rounded-lg bg-navy text-ivory text-sm font-bold hover:bg-navy-dark"
          >
            Enter my volunteer code
          </Link>
          <p className="mt-4 text-[11px] text-navy/40">
            Reference for your chapter chair:{" "}
            <span className="font-mono">{auth.reason}</span>
          </p>
        </div>
      </main>
    );
  }

  return (
    <DeskClient
      volunteerName={auth.volunteer.full_name}
      stationLabel={stationLabel(auth.volunteer.station)}
      canMark={isCheckInStation(auth.volunteer.station)}
    />
  );
}
