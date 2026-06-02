import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { listSessionParameters } from "@/app/yip/actions/session-parameters";
import { listRubrics } from "@/app/yip/actions/admin-rubrics";
import { SessionParametersClient } from "./session-parameters-client";

// Super-admin: configure per-session scoring parameters + weights (global).
// Layout already gates to super-admin; this page just loads data.
export default async function AdminSessionParametersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yip/login");

  const [configs, rubrics] = await Promise.all([
    listSessionParameters(),
    listRubrics(false),
  ]);

  // Offer the default MP /110 rubric criteria as a "seed from handbook" prefill.
  const mp =
    rubrics.find((r) => r.target_role === "mp" && r.is_default) ??
    rubrics.find((r) => r.target_role === "mp") ??
    null;
  const rubricCriteria = mp
    ? mp.criteria.map((c) => ({ key: c.key, label: c.label, max_score: c.max_score }))
    : [];

  return (
    <SessionParametersClient
      initialConfigs={configs}
      rubricCriteria={rubricCriteria}
    />
  );
}
