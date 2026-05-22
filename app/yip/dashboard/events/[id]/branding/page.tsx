import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/yip/supabase/server";
import {
  listComplianceChecks,
  listInvitations,
  getComplianceScore,
} from "@/app/actions/yip/branding";
import { BrandingClient } from "./branding-client";

export default async function BrandingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!event) notFound();

  const [checks, invitations, score] = await Promise.all([
    listComplianceChecks(id),
    listInvitations(id),
    getComplianceScore(id),
  ]);

  return (
    <BrandingClient
      eventId={id}
      eventName={event.name}
      initialChecks={checks}
      initialInvitations={invitations}
      initialScore={score}
    />
  );
}
