import { listAwardDefinitions } from "@/app/yip/actions/admin-awards";
import { AwardsClient } from "./awards-client";

export const dynamic = "force-dynamic";

export default async function AdminAwardsPage() {
  const awards = await listAwardDefinitions();
  return <AwardsClient initialAwards={awards} />;
}
