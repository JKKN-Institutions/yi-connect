import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { listChapterRoles } from "@/app/yip/actions/chapter-roles";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { TeamClient } from "./team-client";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yip/login");

  const access = await getYipEventAccess(id);
  if (!access.canView) {
    return (
      <Forbidden403 reason="You don't have access to this event's team. Your role may not include this event's chapter or zone." />
    );
  }

  // Only chair / national / regional (canManage) may assign roles. Organisers
  // can view the team but not change it.
  const rolesResult = await listChapterRoles(id);
  const roles = rolesResult.ok ? rolesResult.data : [];

  return (
    <TeamClient
      eventId={id}
      canEditTeam={access.canDelete}
      myRole={access.role}
      initialRoles={roles}
    />
  );
}
