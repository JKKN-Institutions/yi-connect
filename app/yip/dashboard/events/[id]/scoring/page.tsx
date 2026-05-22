import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getScoringProgress } from "@/app/actions/results";
import { ScoringProgress } from "./scoring-progress";

export default async function ScoringPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/yip/login");

  // Verify event ownership
  const { data: event } = await supabase
    .from("events")
    .select("id, created_by")
    .eq("id", id)
    .eq("created_by", user.id)
    .single();

  if (!event) redirect("/yip/dashboard");

  const progress = await getScoringProgress(id);

  if (!progress) {
    redirect("/yip/dashboard");
  }

  return <ScoringProgress eventId={id} data={progress} />;
}
