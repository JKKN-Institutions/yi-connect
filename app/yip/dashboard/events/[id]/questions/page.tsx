import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { getQuestions } from "@/app/yip/actions/questions";
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
      <Forbidden403 reason="You don't have access to this event's questions. The event may have been deleted, or your role may not include this event's chapter or zone." />
    );
  }

  // Fetch all questions with submitter info
  const questions = await getQuestions(id);

  return (
    <QuestionsClient
      eventId={id}
      initialQuestions={questions}
      initialOpenAt={event.questions_open_at ?? null}
      initialCloseAt={event.questions_close_at ?? null}
    />
  );
}
