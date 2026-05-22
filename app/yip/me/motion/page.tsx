import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yip/supabase/server";
import {
  getMyMotions,
  getEventMotionCutoff,
} from "@/app/actions/motions";
import { MotionClient } from "./motion-client";

interface ParticipantSession {
  type: "participant";
  id: string;
  name: string;
  eventId: string;
}

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

export default async function MotionPage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("yip_session")?.value;
  const session = parseSession(raw);

  if (!session) {
    redirect("/yip/join");
  }

  const supabase = await createServiceClient();

  const { data: participant } = await supabase
    .from("participants")
    .select(
      "id, full_name, party_side, parliament_role, event_id"
    )
    .eq("id", session.id)
    .single();

  if (!participant) {
    redirect("/yip/join");
  }

  const myMotions = await getMyMotions(session.eventId, participant.id);
  const cutoffAt = await getEventMotionCutoff(session.eventId);

  return (
    <MotionClient
      eventId={session.eventId}
      participantId={participant.id}
      participantRole={participant.parliament_role}
      partySide={participant.party_side}
      myMotions={myMotions}
      cutoffAt={cutoffAt}
    />
  );
}
