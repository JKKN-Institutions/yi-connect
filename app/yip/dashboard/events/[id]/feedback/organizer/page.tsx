import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { OrganizerFeedbackFormClient } from "./organizer-feedback-form-client";
import { Card, CardContent } from "@/components/yip/ui/card";
import { Clock } from "lucide-react";
import { INK, SAFFRON, SERIF, inkA } from "@/app/yip/me/credential-ui";

// This is intentionally a PUBLIC route — organizers / volunteers / jury
// typically don't have dashboard access but need to submit feedback. We
// validate event existence + status here; dedup by email inside the action.

export default async function OrganizerFeedbackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name, status, day1_date, chapter_name")
    .eq("id", id)
    .single();

  if (!event) notFound();

  const allowedStatuses = ["day2_live", "completed", "results_published"];
  const isOpen = allowedStatuses.includes(event.status);

  if (!isOpen) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-10">
        <div className="rounded-2xl bg-gradient-to-br from-[#FF9933]/5 via-white to-[#138808]/5 p-6 shadow-sm ring-1 ring-[#FF9933]/20">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: SAFFRON }}>FEEDBACK</p>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="size-5 text-[#FF9933]" />
            <h1 className="mt-0.5 text-lg font-bold tracking-tight" style={{ ...SERIF, color: INK }}>
              Feedback not open yet
            </h1>
          </div>
          <p className="text-sm" style={{ color: inkA(0.5) }}>
            Feedback for <span className="font-medium">{event.name}</span>{" "}
            opens during the event. Please check back soon.
          </p>
        </div>
        <Card className="mt-4">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-gray-500">
              If you were expecting this form to be open, contact the Chapter
              organizer{event.chapter_name ? ` (${event.chapter_name})` : ""}.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <OrganizerFeedbackFormClient
      eventId={event.id}
      eventName={event.name}
      chapterName={event.chapter_name ?? null}
    />
  );
}
