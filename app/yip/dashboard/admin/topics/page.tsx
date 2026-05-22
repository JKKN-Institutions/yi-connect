import { adminListTopics } from "@/app/actions/yip/admin-topics";
import { TopicsAdminClient } from "./topics-admin-client";

export default async function AdminTopicsPage() {
  const topics = await adminListTopics({ includeInactive: true });
  return <TopicsAdminClient initialTopics={topics} />;
}
