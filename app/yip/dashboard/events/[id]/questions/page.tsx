import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { getQuestions } from "@/app/yip/actions/questions";
import { getCabinetConfig } from "@/app/yip/actions/cabinet";
import { QuestionsClient } from "./questions-client";

export default async function QuestionsPage({
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
      <Forbidden403 reason="You don't have access to this event's questions. The event may have been deleted, or your role may not include this event's chapter or region." />
    );
  }

  // Fetch all questions with submitter info + the event's effective cabinet
  // portfolios (per-event custom ministries, not the static 8) so ministry
  // KEYs resolve to the right labels in the table, dialog and CSV export.
  const [questions, { ministries }] = await Promise.all([
    getQuestions(id),
    getCabinetConfig(id),
  ]);

  return (
    <QuestionsClient
      eventId={id}
      initialQuestions={questions}
      initialOpenAt={event.questions_open_at ?? null}
      initialCloseAt={event.questions_close_at ?? null}
      ministries={ministries}
    />
  );
}
