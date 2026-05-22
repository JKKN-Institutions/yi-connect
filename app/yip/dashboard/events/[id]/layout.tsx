import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { EventTabNav } from "./event-tab-nav";

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/yip/login");
  }

  // Fetch event name for the header
  const { data: event } = await supabase
    .from("events")
    .select("id, name, status")
    .eq("id", id)
    .eq("created_by", user.id)
    .single();

  if (!event) {
    redirect("/yip/dashboard");
  }

  return (
    <div>
      {/* Event Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
      </div>

      {/* Tab Navigation */}
      <EventTabNav eventId={id} eventStatus={event.status} />

      {/* Tab Content */}
      <div className="mt-4">{children}</div>
    </div>
  );
}
