import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getQuestions } from "@/app/actions/questions";
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

  // Verify event ownership
  const { data: event } = await supabase
    .from("events")
    .select("id, name")
    .eq("id", id)
    .eq("created_by", user.id)
    .single();

  if (!event) redirect("/yip/dashboard");

  // Fetch all questions with submitter info
  const questions = await getQuestions(id);

  return <QuestionsClient eventId={id} initialQuestions={questions} />;
}
