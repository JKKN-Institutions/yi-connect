import { adminListTeam } from "@/app/actions/admin-team";
import { TeamAdminClient } from "./team-client";

export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  const members = await adminListTeam({ includeInactive: true });

  return <TeamAdminClient initialMembers={members} />;
}
