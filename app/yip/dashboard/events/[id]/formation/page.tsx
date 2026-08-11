/**
 * YIP Online House Formation — organiser console (Regional Round only).
 *
 * Pre-event, fully-online formation of the House: random allocation + parties,
 * then time-windowed remote ballots (Speaker → Party Leaders → PM → LoP),
 * appointments, and the final lock. Participants vote from home on /yip/me/vote
 * via their access-code deep link; this page is the organiser's mission control.
 *
 * Gate: EVENT-SCOPED, canManage (plan §4). Denials render <Forbidden403> —
 * never a silent redirect. Non-regional events get an inline notice (the tab is
 * also hidden for them, but deep links must still explain themselves).
 */
import type { Metadata } from "next";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { getEvent } from "@/app/yip/actions/events";
import { effectiveMinistries } from "@/lib/yip/cabinet";
import { INK, SAFFRON, SERIF } from "@/app/yip/me/credential-ui";
import {
  sweepFormationDeadlines,
  getFormationState,
} from "@/app/yip/actions/formation";
import { getFormationInvitePlan } from "@/app/yip/actions/formation-emails";
import { FormationClient } from "./formation-client";

export const metadata: Metadata = {
  title: "Online House Formation — YIP 2026",
};

export default async function FormationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const access = await getYipEventAccess(id);
  if (!access.canManage) {
    return (
      <Forbidden403 reason="Only this event's organisers can run Online House Formation. If you should have access, ask your chapter chair to add you to the event team." />
    );
  }

  const event = await getEvent(id);
  if (!event) {
    return (
      <Forbidden403 reason="You don't have access to this event, or it may have been deleted." />
    );
  }

  // Online formation exists ONLY for Regional Round events. Inline notice (not
  // a 403) — the viewer legitimately manages this event; the feature simply
  // doesn't apply at this level.
  if (event.level !== "regional") {
    return (
      <div className="rounded-xl border border-[#1a1a3e]/10 bg-white p-6 shadow-sm">
        <p
          className="text-[10px] font-bold uppercase tracking-[0.16em]"
          style={{ color: SAFFRON }}
        >
          Online House Formation
        </p>
        <h2
          className="mt-1 text-lg font-bold"
          style={{ ...SERIF, color: INK }}
        >
          Not available for this event
        </h2>
        <p className="mt-2 max-w-xl text-sm text-[#1a1a3e]/60">
          Online House Formation runs only for <strong>Regional Round</strong>{" "}
          events (this event is a {event.level} round). Chapter rounds form
          their House in the hall on event day via the Control panel.
        </p>
      </div>
    );
  }

  // Sweep any past-deadline open ballots BEFORE reading state, so the
  // checklist never shows a window as live after it has ended (plan §3.2).
  // Failure is non-fatal — casts are hard-blocked server-side regardless.
  await sweepFormationDeadlines(id);

  const [stateRes, planRes] = await Promise.all([
    getFormationState(id),
    getFormationInvitePlan(id),
  ]);

  return (
    <FormationClient
      eventId={id}
      eventName={event.name}
      day1Date={event.day1_date ?? null}
      ministries={effectiveMinistries(event.cabinet_ministries)}
      initialState={stateRes.success ? stateRes.data : null}
      initialError={stateRes.success ? null : stateRes.error}
      invitePlan={planRes.success ? planRes.data : null}
      invitePlanError={planRes.success ? null : planRes.error}
    />
  );
}
