import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getAllSeasons } from "@/app/actions/yip/pipeline";
import { AdminDashboardClient } from "./admin-client";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/yip/login");

  const seasons = await getAllSeasons();

  return <AdminDashboardClient seasons={seasons} />;
}
