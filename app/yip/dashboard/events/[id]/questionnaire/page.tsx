import { getYipEventAccess } from "@/lib/yip/auth/event-access";
import { getEvent } from "@/app/yip/actions/events";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import {
  getQuestionnaireOverview,
  getQuestionnaireResults,
} from "@/app/yip/actions/questionnaire";
import { QuestionnaireAdminClient } from "./questionnaire-admin-client";

/**
 * Organiser view of the selection questionnaire.
 *
 * Denies EXPLICITLY with Forbidden403 rather than redirecting — a silent
 * redirect to a landing page produces a bounce-loop nobody can diagnose.
 *
 * canView reads; canManage switches a window, edits questions, exports or
 * re-scores. The prop is a UI affordance only — every action re-checks.
 */
export default async function QuestionnairePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const access = await getYipEventAccess(id);
  if (!access.canView) {
    return (
      <Forbidden403 reason="You don't have access to this event's selection questionnaire." />
    );
  }

  const [overview, results, event] = await Promise.all([
    getQuestionnaireOverview(id),
    getQuestionnaireResults(id),
    getEvent(id),
  ]);

  return (
    <QuestionnaireAdminClient
      eventId={id}
      eventName={event?.name ?? ""}
      canManage={access.canManage}
      initialPosts={overview.success ? overview.data.posts : []}
      minutes={overview.success ? overview.data.minutes : 30}
      initialRows={results.success ? results.data.rows : []}
      initialUnscored={results.success ? results.data.unscored : 0}
      initialMissing={results.success ? results.data.missing : []}
      initialError={
        overview.success ? (results.success ? null : results.error) : overview.error
      }
    />
  );
}

export const metadata = {
  title: "Selection Questionnaire — YIP 2026",
};
