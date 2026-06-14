/**
 * User Guide — role-aware smart guide.
 *
 * Detects the viewer's role and opens on THEIR lane (Member / Chapter
 * Leadership / Vertical Head / Coordinator / National). Each step deep-links to
 * the real screen; steps are checkable and progress is saved per user. Replaces
 * the old static help accordion — its content is folded into lib/guide/content.ts.
 *
 * Lives inside the (dashboard) route group, so the sidebar + chrome wrap it.
 */
import {
  isGuidePersona,
  type GuideBook,
  type GuidePersona,
} from "@/lib/guide/types";
import { GUIDES } from "@/lib/guide/content";
import { GuideView } from "@/components/guide/GuideView";
import { getCompletedSteps, toggleStep, logGuideEvent } from "@/lib/guide/actions";
import { detectLane } from "@/lib/guide/detect-lane";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Guide - Yi Connect",
  description: "Learn how to use Yi Connect, tailored to your role",
};

const BASE_PATH = "/user-guide";
// Activation checklist: checkable steps + saved progress + instrumentation.
const TRACK_PROGRESS = true;

export default async function UserGuidePage({
  searchParams,
}: {
  searchParams: Promise<{ persona?: string }>;
}) {
  const { persona: requestedRaw } = await searchParams;
  const { persona: own, scopeId, visible, denied } = await detectLane();

  // Explicit denial — never a silent redirect (rule #27).
  if (denied) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <h1 className="text-xl font-bold">You don&apos;t have access to this area yet.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask an admin to enrol you. Once you have access, this guide opens on your role automatically.
        </p>
      </div>
    );
  }

  // Allow switching, but only to a lane the viewer is permitted to see.
  const requested = isGuidePersona(requestedRaw) ? requestedRaw : null;
  const persona: GuidePersona = requested && visible.includes(requested) ? requested : own;

  const completed = TRACK_PROGRESS ? await getCompletedSteps(persona) : [];

  return (
    <div className="mx-auto max-w-3xl">
      <GuideView
        // Remount per lane so progress state + the guide_open/lane_complete refs
        // re-seed from the new lane (a ?persona= switch is a soft nav otherwise).
        key={persona}
        guides={GUIDES as GuideBook}
        persona={persona}
        visiblePersonas={visible}
        scopeId={scopeId}
        basePath={BASE_PATH}
        scopeFallbackHref="/dashboard"
        trackProgress={TRACK_PROGRESS}
        initialCompleted={completed}
        onToggleStep={toggleStep}
        onEvent={logGuideEvent}
      />
    </div>
  );
}
