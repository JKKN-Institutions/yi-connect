import { redirect } from "next/navigation";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import Link from "next/link";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getPmGovernmentBills } from "@/app/yip/actions/pm";
import { getMinistryDesk } from "@/app/yip/actions/ministry";
import { PmClient } from "./pm-client";

const PM_ROLES = ["prime_minister", "deputy_prime_minister"];

const ROLE_LABEL: Record<string, string> = {
  prime_minister: "Prime Minister",
  deputy_prime_minister: "Deputy Prime Minister",
};

export default async function PmPage() {
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
  if (!role || !PM_ROLES.includes(role)) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-lg font-bold text-[#1a1a3e]">Prime Minister&apos;s Desk</h1>
        <p className="mt-2 text-sm text-[#1a1a3e]/60">
          This area is only for the Prime Minister and Deputy Prime Minister.
          Your role doesn&apos;t include it.
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

  const [billsResult, deskResult] = await Promise.all([
    getPmGovernmentBills(session.eventId, participant.id),
    getMinistryDesk(session.eventId, participant.id),
  ]);

  return (
    <PmClient
      eventId={session.eventId}
      participantId={participant.id}
      roleLabel={ROLE_LABEL[role] ?? "Prime Minister"}
      initialBills={billsResult.success ? billsResult.data : []}
      billsError={billsResult.success ? null : billsResult.error}
      initialDesk={deskResult.success ? deskResult.data : null}
      deskError={deskResult.success ? null : deskResult.error}
    />
  );
}
