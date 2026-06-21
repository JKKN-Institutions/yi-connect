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
      <Forbidden403 reason="You don't have access to this event's team. Your role may not include this event's chapter or region." />
    );
  }

  // Only chair / national / regional (canManage) may assign roles. Organisers
  // can view the team but not change it.
  const rolesResult = await listChapterRoles(id);
  const roles = rolesResult.ok ? rolesResult.data : [];

  // Offer the linked chapter's chair as a one-click prefill (inheritance from
  // yi.chapters). Read-only lookup; never auto-creates a login.
  let suggestedChair: { name: string; email: string } | null = null;
  const { data: event } = await supabase
    .from("events")
    .select("yi_chapter_id")
    .eq("id", id)
    .maybeSingle();
  if (event?.yi_chapter_id) {
    const { data: chapter } = await supabase
      .schema("yi")
      .from("chapters")
      .select("chair_name, chair_email")
      .eq("id", event.yi_chapter_id)
      .maybeSingle();
    if (chapter?.chair_email) {
      suggestedChair = {
        name: chapter.chair_name ?? "",
        email: chapter.chair_email,
      };
    }
  }

  return (
    <TeamClient
      eventId={id}
      canEditTeam={access.canDelete}
      myRole={access.role}
      initialRoles={roles}
      suggestedChair={suggestedChair}
    />
  );
}
