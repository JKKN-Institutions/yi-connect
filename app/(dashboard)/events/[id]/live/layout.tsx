/**
 * Live Event Dashboard Layout (Stutzee 2C)
 *
 * Full-screen kiosk layout — intentionally drops the dashboard sidebar,
 * header, bottom navbar, bug reporter and activity planner so a projector
 * or external screen shows ONLY the live attendance wall.
 *
 * This layout is nested inside the (dashboard) route group, so the
 * middleware's session check still applies (auth cookie flows through).
 */

import { unstable_noStore as noStore } from 'next/cache';

export default function LiveEventLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Never cache — always hit server for fresh Supabase session + data
  noStore();

  return (
    <div
      className='fixed inset-0 z-50 min-h-screen w-screen overflow-hidden bg-slate-950 text-slate-50'
      data-kiosk='live-event-dashboard'
    >
      {children}
    </div>
  );
}
