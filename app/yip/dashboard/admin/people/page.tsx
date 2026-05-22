import { listPeople } from "@/app/actions/people";
import { PeopleAdminClient } from "./people-admin-client";

export default async function AdminPeoplePage() {
  const people = await listPeople({ includeInactive: true, limit: 1000 });
  return <PeopleAdminClient initialPeople={people} />;
}
