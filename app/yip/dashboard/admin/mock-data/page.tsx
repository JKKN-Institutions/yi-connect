import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getMockDataStats } from "@/app/actions/yip/mock-data";
import { MockDataClient } from "./mock-data-client";

export default async function AdminMockDataPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yip/login");

  const initialStats = await getMockDataStats();

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6">
      <MockDataClient initialStats={initialStats} />
    </div>
  );
}
