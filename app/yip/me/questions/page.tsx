import { redirect } from "next/navigation";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import { getCabinetConfig } from "@/app/yip/actions/cabinet";
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

  return <QuestionsClient initialSession={session} ministries={ministries} />;
}
