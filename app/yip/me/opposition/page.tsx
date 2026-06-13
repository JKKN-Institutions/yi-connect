import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import Link from "next/link";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getGovernmentBills } from "@/app/yip/actions/opposition";
import { OppositionClient } from "./opposition-client";

interface ParticipantSession {
  type: "participant";
  id: string;
  name: string;
  eventId: string;
}

function parseSession(raw: string | undefined): ParticipantSession | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (p.type === "participant" && p.id && p.name && p.eventId) return p as ParticipantSession;
    return null;
  } catch {
    return null;
  }
}

export default async function OppositionPage() {
  const cookieStore = await cookies();
  const session = await getYipSession();
  if (!session || session.type !== "participant") redirect("/yip/join");

  const supabase = await createServiceClient();
  const { data: participant } = await supabase
    .from("participants")
    .select("id, parliament_role")
    .eq("id", session.id)
    .maybeSingle();
  if (!participant) redirect("/yip/join");

  if (participant.parliament_role !== "leader_of_opposition") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-lg font-bold text-[#1a1a3e]">Leader of Opposition</h1>
        <p className="mt-2 text-sm text-[#1a1a3e]/60">
          This area is only for the Leader of Opposition. Your role doesn&apos;t include it.
        </p>
        <Link
          href="/yip/me"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#FF9933] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Back to my dashboard
        </Link>
      </div>
    );
  }

  const billsResult = await getGovernmentBills(session.eventId, participant.id);

  return (
    <OppositionClient
      eventId={session.eventId}
      participantId={participant.id}
      initialBills={billsResult.success ? billsResult.data : []}
      loadError={billsResult.success ? null : billsResult.error}
    />
  );
}
