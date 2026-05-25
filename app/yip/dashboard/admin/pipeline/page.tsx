import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getAllSeasons } from "@/app/yip/actions/pipeline";
import { PipelineClient } from "./pipeline-client";

export default async function PipelinePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/yip/login");

  const seasons = await getAllSeasons();

  return <PipelineClient seasons={seasons} />;
}
