import { listTopics } from "@/app/actions/yip/topics";
import { TopicsClient } from "./topics-client";

export default async function TopicsPage() {
  const all = await listTopics();
  return <TopicsClient initialTopics={all} />;
}
