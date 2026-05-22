import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { adminListChecklistTemplate } from "@/app/actions/admin-checklist";
import { ChecklistTemplateClient } from "./checklist-template-client";

export const dynamic = "force-dynamic";

export default async function AdminChecklistPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/yip/login");

  const items = await adminListChecklistTemplate({ includeInactive: true });

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6">
      <ChecklistTemplateClient initialItems={items} />
    </div>
  );
}
