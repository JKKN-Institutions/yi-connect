import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { listRubrics } from "@/app/actions/admin-rubrics";
import { RubricsClient } from "./rubrics-client";

export default async function AdminRubricsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/yip/login");

  const rubrics = await listRubrics(true);

  return <RubricsClient initialRubrics={rubrics} />;
}
