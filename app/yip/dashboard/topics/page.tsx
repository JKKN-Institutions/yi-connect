import { listTopics } from "@/app/yip/actions/topics";
import { TopicsClient } from "./topics-client";
import { canViewYipNationalRollup } from "@/lib/yip/auth/event-access";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";

export default async function TopicsPage() {
  if (!(await canViewYipNationalRollup())) {
    return <Forbidden403 reason="The central topics library is for national and regional admins." />;
  }
  const all = await listTopics();
  return <TopicsClient initialTopics={all} />;
}
