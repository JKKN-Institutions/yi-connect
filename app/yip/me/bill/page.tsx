import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { BillClient, type ParticipantSession } from "./bill-client";

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

  return (
    <BillClient
      initialSession={session}
      parliamentRole={p?.parliament_role ?? null}
      committeeName={p?.committee_name ?? null}
    />
  );
}
