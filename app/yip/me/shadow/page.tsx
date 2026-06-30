import { redirect } from "next/navigation";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import Link from "next/link";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getShadowDesk } from "@/app/yip/actions/shadow";
import { getCabinetConfig } from "@/app/yip/actions/cabinet";
import { ShadowClient } from "./shadow-client";

export default async function ShadowPage() {
  const session = await getYipSession();
  if (!session || session.type !== "participant") redirect("/yip/join");

  const supabase = await createServiceClient();
  const { data: participant } = await supabase
    .from("participants")
    .select("id, parliament_role")
    .eq("id", session.id)
    .maybeSingle();
  if (!participant) redirect("/yip/join");

  if (participant.parliament_role !== "shadow_minister") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-lg font-bold text-[#1a1a3e]">Shadow Minister&apos;s Desk</h1>
        <p className="mt-2 text-sm text-[#1a1a3e]/60">
          This area is only for a Shadow minister — to track your counterpart
          ministry and file counters. Your role doesn&apos;t include it.
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
    getShadowDesk(session.eventId, participant.id),
    getCabinetConfig(session.eventId),
  ]);

  return (
    <ShadowClient
      eventId={session.eventId}
      participantId={participant.id}
      initialDesk={result.success ? result.data : null}
      loadError={result.success ? null : result.error}
      ministries={ministries}
    />
  );
}
