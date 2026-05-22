import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { adminListBrandingRules } from "@/app/actions/yip/admin-branding-rules";
import { BrandingRulesClient } from "./branding-rules-client";

export default async function AdminBrandingRulesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/yip/login");

  const rules = await adminListBrandingRules(true);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6">
      <BrandingRulesClient initialRules={rules} />
    </div>
  );
}
