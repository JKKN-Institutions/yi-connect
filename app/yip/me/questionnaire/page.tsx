import { redirect } from "next/navigation";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import { getMyQuestionnaire } from "@/app/yip/actions/questionnaire";
import { QuestionnaireClient } from "./questionnaire-client";

/**
 * The student's selection questionnaire.
 *
 * Three layers of gate, in order: middleware (requireAccessCodeCookie on
 * /yip/me/*), this page (getYipSession + redirect), and then every action via
 * requireMe(). Nothing about the participant is passed down to the client as an
 * authorization signal — eventId is a scope hint, and the action rejects it if
 * it is not the session's event.
 *
 * Fails closed: if the read errors, the client gets an empty post list plus the
 * reason, not a half-open screen.
 */
export default async function QuestionnairePage() {
  const session = await getYipSession();
  if (!session || session.type !== "participant") {
    redirect("/yip/join");
  }

  const res = await getMyQuestionnaire(session.eventId);

  return (
    <QuestionnaireClient
      eventId={session.eventId}
      initialPosts={res.success ? res.data.posts : []}
      loadError={res.success ? null : res.error}
    />
  );
}

export const metadata = {
  title: "Selection Questions — YIP 2026",
};
