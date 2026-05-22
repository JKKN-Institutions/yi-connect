import { listSchools, getSchoolParticipationStats } from "@/app/actions/yip/schools";
import { SchoolsClient } from "./schools-client";

export default async function SchoolsPage() {
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
