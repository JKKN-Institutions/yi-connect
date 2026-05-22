import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getResults } from "@/app/actions/results";
import { ResultsClient } from "./results-client";

export default async function ResultsPage({
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

  // Verify event ownership and get event details
  const { data: event } = await supabase
    .from("events")
    .select("id, name, created_by, results_published_at, scores_locked")
    .eq("id", id)
    .eq("created_by", user.id)
    .single();

  if (!event) redirect("/yip/dashboard");

  const results = await getResults(id);

  return (
    <ResultsClient
      eventId={id}
      eventName={event.name}
      resultsPublishedAt={event.results_published_at}
      results={results}
    />
  );
}
