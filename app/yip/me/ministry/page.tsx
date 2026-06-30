import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import Link from "next/link";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getMinistryDesk } from "@/app/yip/actions/ministry";
import { getCabinetConfig } from "@/app/yip/actions/cabinet";
import { MinistryClient } from "./ministry-client";

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

const MINISTRY_ROLES = [
  "cabinet_minister",
  "prime_minister",
  "deputy_prime_minister",
  "shadow_minister",
];

export default async function MinistryPage() {
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

  const role = participant.parliament_role;
  if (!role || !MINISTRY_ROLES.includes(role)) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-lg font-bold text-[#1a1a3e]">Ministry Desk</h1>
        <p className="mt-2 text-sm text-[#1a1a3e]/60">
          This area is for Cabinet ministers, the PM, and Shadow ministers — to
          answer questions and motions directed to a ministry. Your role
          doesn&apos;t include it.
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

  const [result, { ministries }] = await Promise.all([
    getMinistryDesk(session.eventId, participant.id),
    getCabinetConfig(session.eventId),
  ]);

  return (
    <MinistryClient
      eventId={session.eventId}
      participantId={participant.id}
      initialDesk={result.success ? result.data : null}
      loadError={result.success ? null : result.error}
      ministries={ministries}
    />
  );
}
