import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { isCommitteeReportSubmitted } from "@/app/yip/actions/committee-reports";
import { BillClient, type ParticipantSession } from "./bill-client";
import { BillFeedbackCard } from "./bill-feedback-card";

// The yip_session cookie is httpOnly (set by app/yip/actions/auth.ts), so it
// must be read server-side — a client component's document.cookie never sees
// it. Same pattern as app/yip/me/motion/page.tsx.

function parseSession(raw: string | undefined): ParticipantSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed.type === "participant" &&
      parsed.id &&
      parsed.name &&
      parsed.eventId
    ) {
      return parsed as ParticipantSession;
    }
    return null;
  } catch {
    return null;
  }
}

export default async function BillDraftingPage() {
  const session = await getYipSession();

  if (!session || session.type !== "participant") {
    redirect("/yip/join");
  }

  // The participant's parliament_role + committee_name live on columns the
  // browser anon client can't read (RLS), so read them server-side here and
  // pass down — the client uses them to gate the drafting UI.
  const supabase = await createServiceClient();
  const { data: p } = await supabase
    .from("participants")
    .select("parliament_role, committee_name")
    .eq("id", session.id)
    .maybeSingle();

  // Look up the committee's official topic + linked scheme from the yip.topics
  // catalog (category = 'committee', title = the committee name) so drafting
  // shows what students should write the bill on. Older events whose committee
  // names predate the official 15 simply won't match → topic/scheme stay null.
  let committeeTopic: string | null = null;
  let committeeScheme: string | null = null;
  if (p?.committee_name) {
    const { data: ct } = await supabase
      .from("topics")
      .select("description, linked_scheme")
      .eq("category", "committee")
      .eq("title", p.committee_name)
      .eq("is_active", true)
      .maybeSingle();
    committeeTopic = ct?.description ?? null;
    committeeScheme = ct?.linked_scheme ?? null;
  }

  // The bill is locked until this committee submits its Committee Report —
  // UNLESS the organiser has flipped the per-event early-unlock toggle (so
  // committees can pre-draft a few days ahead). Either path unlocks the bill.
  let reportSubmitted = false;
  if (p?.committee_name) {
    const submitted = await isCommitteeReportSubmitted(
      session.eventId,
      p.committee_name
    );
    const { data: ev } = await supabase
      .from("events")
      .select("allow_bill_before_report")
      .eq("id", session.eventId)
      .maybeSingle();
    reportSubmitted = submitted || Boolean(ev?.allow_bill_before_report);
  }

  return (
    <div className="space-y-5">
      <BillClient
        initialSession={session}
        parliamentRole={p?.parliament_role ?? null}
        committeeName={p?.committee_name ?? null}
        committeeTopic={committeeTopic}
        committeeScheme={committeeScheme}
        reportSubmitted={reportSubmitted}
      />
      {/* AI craft feedback on this committee's bill. Self-gates: renders nothing
          unless events.ai_enabled is on and the viewer has a committee. */}
      <BillFeedbackCard
        eventId={session.eventId}
        committeeName={p?.committee_name ?? null}
      />
    </div>
  );
}
