import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { getResults } from "@/app/yip/actions/results";
import { ResultsClient } from "./results-client";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";

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

  const event = await getEvent(id);

  if (!event) {
    return (
      <Forbidden403 reason="You don't have access to this event's results. The event may have been deleted, or your role may not include this event's chapter or zone." />
    );
  }

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
