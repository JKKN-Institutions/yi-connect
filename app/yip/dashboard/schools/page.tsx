import { listSchools, getSchoolParticipationStats } from "@/app/yip/actions/schools";
import { SchoolsClient } from "./schools-client";
import { canViewYipNationalRollup } from "@/lib/yip/auth/event-access";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";

export default async function SchoolsPage() {
  if (!(await canViewYipNationalRollup())) {
    return <Forbidden403 reason="The schools directory is for national and regional admins." />;
  }
  const [schools, stats] = await Promise.all([
    listSchools(),
    getSchoolParticipationStats(),
  ]);

  const statsById = new Map(stats.map((s) => [s.school_id, s]));

  const enriched = schools.map((s) => ({
    ...s,
    total_participations: statsById.get(s.id)?.total_participations ?? 0,
    events_count: statsById.get(s.id)?.events_count ?? 0,
  }));

  return <SchoolsClient initialSchools={enriched} />;
}
