import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { getMyFeedback } from "@/app/yip/actions/feedback";
import { FeedbackFormClient } from "./feedback-form-client";
import { Card, CardContent } from "@/components/yip/ui/card";
import { CheckCircle2, Sparkles, Star } from "lucide-react";

// ─── Session parsing (server-side, matches /me/page.tsx) ──────────────

interface ParticipantSession {
  type: "participant";
  id: string;
  name: string;
  eventId: string;
}

function parseSession(raw: string | undefined): ParticipantSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed.type === "participant" &&
      parsed.id &&
      parsed.name &&
      parsed.eventId
    ) {
      return parsed as ParticipantSession;
    }
    return null;
  } catch {
    return null;
  }
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ParticipantFeedbackPage() {
  const session = await getYipSession();
  if (!session || session.type !== "participant") redirect("/yip/join");

  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, status, day1_date, day2_date")
    .eq("id", session.eventId)
    .single();

  if (!event) redirect("/yip/join");

  const existing = await getMyFeedback(session.eventId, session.id);

  // Already submitted — thank-you state
  if (existing) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-emerald-50 p-6 shadow-lg ring-1 ring-emerald-200/60">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-400 shadow-sm">
              <CheckCircle2 className="size-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                You&apos;ve already submitted. Thank you!
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Received on {formatDateTime(existing.submitted_at)}
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">
            Your feedback helps the Yi team improve future sessions of the
            Young Indians Parliament. We read every response.
          </p>

          {existing.overall_rating !== null && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2">
              <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                Your rating
              </span>
              <div className="flex items-center gap-0.5 ml-auto">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={
                      "size-4 " +
                      (i < (existing.overall_rating ?? 0)
                        ? "fill-[#FF9933] text-[#FF9933]"
                        : "text-gray-200")
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {existing.biggest_takeaway && (
          <Card>
            <CardContent className="pt-5">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-1">
                Your biggest takeaway
              </p>
              <p className="text-sm text-gray-800 leading-relaxed">
                {existing.biggest_takeaway}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Prevent submitting before event has run enough to have signal.
  // Block in draft / pre-registration. Open from day1_live onwards.
  const openStatuses = [
    "day1_live",
    "day1_complete",
    "day2_live",
    "completed",
    "results_published",
  ];
  if (!openStatuses.includes(event.status)) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl bg-gradient-to-br from-[#FF9933]/5 via-white to-[#138808]/5 p-6 shadow-sm ring-1 ring-[#FF9933]/20">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="size-5 text-[#FF9933]" />
            <h1 className="text-lg font-bold text-gray-900">
              Feedback opens during the event
            </h1>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            Once the Parliament session begins, you&apos;ll be able to share
            how it went. Check back on event day!
          </p>
        </div>
      </div>
    );
  }

  return (
    <FeedbackFormClient
      eventId={event.id}
      eventName={event.name}
      participantId={session.id}
      participantName={session.name}
    />
  );
}
