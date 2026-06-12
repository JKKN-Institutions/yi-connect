import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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
  const cookieStore = await cookies();
  const session = parseSession(cookieStore.get("yip_session")?.value);

  if (!session) {
    redirect("/yip/join");
  }

  return <BillClient initialSession={session} />;
}
