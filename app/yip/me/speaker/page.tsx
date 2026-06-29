import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import Link from "next/link";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { ROLE_LABELS } from "@/lib/yip/constants";
import { getSpeakerMotions } from "@/app/yip/actions/speaker";
import { PRESIDING_ROLES } from "@/lib/yip/auth/leadership";
import { SpeakerClient } from "./speaker-client";
import { INK, GOLD, SERIF, inkA } from "../credential-ui";

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
    if (parsed.type === "participant" && parsed.id && parsed.name && parsed.eventId) {
      return parsed as ParticipantSession;
    }
    return null;
  } catch {
    return null;
  }
}

export default async function SpeakerPage() {
  const cookieStore = await cookies();
  const session = await getYipSession();
  if (!session || session.type !== "participant") redirect("/yip/join");

  const supabase = await createServiceClient();
  const { data: participant } = await supabase
    .from("participants")
    .select("id, full_name, parliament_role, event_id")
    .eq("id", session.id)
    .maybeSingle();

  if (!participant) redirect("/yip/join");

  const role = participant.parliament_role;
  const isPresiding = !!role && (PRESIDING_ROLES as readonly string[]).includes(role);

  // Fail-closed with an explicit message (not a silent bounce) — CLAUDE.md rule 27.
  if (!isPresiding) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p
          className="text-[10px] font-bold uppercase tracking-[0.16em]"
          style={{ color: GOLD }}
        >
          The Chair
        </p>
        <h1
          className="mt-0.5 text-[28px] font-bold leading-[1.1] tracking-tight"
          style={{ ...SERIF, color: INK }}
        >
          Speaker&apos;s Desk
        </h1>
        <p className="mt-2 text-sm" style={{ color: inkA(0.6) }}>
          This area is only for the Speaker and Deputy Speaker — for presiding over
          and ruling on motions. Your role doesn&apos;t include it.
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

  const result = await getSpeakerMotions(session.eventId, participant.id);
  const motions = result.success ? result.data : [];

  return (
    <SpeakerClient
      eventId={session.eventId}
      participantId={participant.id}
      roleLabel={role ? ROLE_LABELS[role] ?? "Speaker" : "Speaker"}
      initialMotions={motions}
      loadError={result.success ? null : result.error}
    />
  );
}
