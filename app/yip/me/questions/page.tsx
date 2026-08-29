import { redirect } from "next/navigation";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import { getCabinetConfig } from "@/app/yip/actions/cabinet";
import { getMyQuestionStatus } from "@/app/yip/actions/questions";
import { QuestionsClient } from "./questions-client";

// The yip_session cookie is httpOnly (set by app/yip/actions/auth.ts), so it
// must be read server-side — a client component's document.cookie never sees
// it. Same pattern as app/yip/me/motion/page.tsx.

export default async function QuestionsPage() {
  const session = await getYipSession();

  if (!session || session.type !== "participant") {
    redirect("/yip/join");
  }

  // The event's effective cabinet portfolios drive the "Directed to Ministry"
  // dropdown + labels — per-event custom ministries, not the static 8.
  const { ministries } = await getCabinetConfig(session.eventId);

  // The submission window (events.questions_open_at / questions_close_at).
  // submitQuestion enforces it server-side; without it here the member types a
  // whole question into a form that was always going to be rejected.
  const status = await getMyQuestionStatus();

  return (
    <QuestionsClient
      initialSession={session}
      ministries={ministries}
      openAt={status?.openAt ?? null}
      closeAt={status?.closeAt ?? null}
    />
  );
}
