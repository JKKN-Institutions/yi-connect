import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { eventPrivacyMasked } from "@/lib/yip/pii";
import { VoteClient, type ParticipantSession } from "./vote-client";

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

export default async function VotePage() {
  const session = await getYipSession();

  if (!session || session.type !== "participant") {
    redirect("/yip/join");
  }

  // DPDP: privacy-mode events show other candidates' names as pseudonyms.
  const supabase = await createServiceClient();
  const { data: event } = await supabase
    .from("events")
    .select("privacy_mode, pii_purged_at")
    .eq("id", session.eventId)
    .single();
  const masked = event ? eventPrivacyMasked(event) : false;

  return <VoteClient initialSession={session} masked={masked} />;
}
