import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { listChapterPrivacyDefaults } from "@/app/yip/actions/pii";
import { PrivacyAdminClient } from "./privacy-client";

// Super-admin only (the admin layout gates the whole /admin area).
export const dynamic = "force-dynamic";

export default async function AdminPrivacyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yip/login");

  const chapters = await listChapterPrivacyDefaults();
  return <PrivacyAdminClient initialChapters={chapters} />;
}
