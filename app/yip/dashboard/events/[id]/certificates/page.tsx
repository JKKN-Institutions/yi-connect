import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { getCertificateData } from "@/app/actions/yip/certificates";
import { CertificatesClient } from "./certificates-client";

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

  // Verify event ownership
  const { data: event } = await supabase
    .from("events")
    .select("id, name, created_by, results_published_at, chapter_name")
    .eq("id", id)
    .eq("created_by", user.id)
    .single();

  if (!event) redirect("/yip/dashboard");

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
