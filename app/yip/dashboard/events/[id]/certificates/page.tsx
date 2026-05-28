import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getEvent } from "@/app/yip/actions/events";
import { getCertificateData } from "@/app/yip/actions/certificates";
import { CertificatesClient } from "./certificates-client";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";

export default async function CertificatesPage({
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

  const event = await getEvent(id);

  if (!event) {
    return (
      <Forbidden403 reason="You don't have access to this event's certificates. The event may have been deleted, or your role may not include this event's chapter or zone." />
    );
  }

  const certData = await getCertificateData(id);

  return (
    <CertificatesClient
      eventId={id}
      eventName={event.name}
      resultsPublished={!!event.results_published_at}
      chapterName={event.chapter_name}
      certData={certData}
    />
  );
}
