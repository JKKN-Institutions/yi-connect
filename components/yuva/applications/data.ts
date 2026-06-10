import "server-only";

/**
 * Applications-review read-side assembly (Phase 9). READ-ONLY — every
 * mutation goes through app/youth-academy/actions/applications.ts
 * (gate-first).
 *
 * ⚠️ Callers are gated pages — these helpers do NOT authorize.
 * ⚠️ Access codes are NEVER selected here — they are login credentials;
 *    resend/regenerate work by enrollment id only.
 */

import { createServiceClient } from "@/lib/yuva/supabase/service";

type Svc = Awaited<ReturnType<typeof createServiceClient>>;

export type ApplicationQueueRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  dob: string | null;
  degree: string | null;
  year_of_study: string | null;
  institution_name: string | null;
  yuva_member_claim: string;
  motivation: string;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  person_id: string | null;
  /** Non-null ⇒ this applicant is in the cohort. */
  enrollment_id: string | null;
};

/** Minimal loose cast for the cross-schema yi.institutions name lookup. */
function yiInstitutions(svc: Svc) {
  return (
    svc.schema("yi" as never) as unknown as {
      from: (table: "institutions") => {
        select: (cols: string) => {
          in: (
            col: string,
            vals: string[]
          ) => Promise<{
            data: Array<{ id: string; name: string }> | null;
          }>;
        };
      };
    }
  ).from("institutions");
}

export async function fetchApplicationsQueue(
  runId: string
): Promise<ApplicationQueueRow[]> {
  const svc = await createServiceClient();

  const [{ data: applications }, { data: enrollments }] = await Promise.all([
    svc
      .from("applications")
      .select(
        "id, full_name, email, phone, dob, degree, year_of_study, institution_id, institution_other, yuva_member_claim, motivation, status, review_note, reviewed_at, created_at, person_id"
      )
      .eq("run_id", runId)
      .order("created_at", { ascending: true }),
    svc
      .from("enrollments")
      .select("id, application_id, person_id")
      .eq("run_id", runId),
  ]);
  if (!applications || applications.length === 0) return [];

  // Resolve institution names (canonical master: yi.institutions).
  const institutionIds = [
    ...new Set(
      applications
        .map((a) => a.institution_id)
        .filter((id): id is string => !!id)
    ),
  ];
  const institutionNameById = new Map<string, string>();
  if (institutionIds.length > 0) {
    const { data: institutions } = await yiInstitutions(svc)
      .select("id, name")
      .in("id", institutionIds);
    for (const inst of institutions ?? []) {
      institutionNameById.set(inst.id, inst.name);
    }
  }

  const enrollmentByApplicationId = new Map<string, string>();
  const enrollmentByPersonId = new Map<string, string>();
  for (const e of enrollments ?? []) {
    if (e.application_id) enrollmentByApplicationId.set(e.application_id, e.id);
    enrollmentByPersonId.set(e.person_id, e.id);
  }

  return applications.map((a) => ({
    id: a.id,
    full_name: a.full_name,
    email: a.email,
    phone: a.phone,
    dob: a.dob,
    degree: a.degree,
    year_of_study: a.year_of_study,
    institution_name: a.institution_id
      ? (institutionNameById.get(a.institution_id) ?? a.institution_other)
      : a.institution_other,
    yuva_member_claim: a.yuva_member_claim,
    motivation: a.motivation,
    status: a.status,
    review_note: a.review_note,
    reviewed_at: a.reviewed_at,
    created_at: a.created_at,
    person_id: a.person_id,
    enrollment_id:
      enrollmentByApplicationId.get(a.id) ??
      (a.person_id ? (enrollmentByPersonId.get(a.person_id) ?? null) : null),
  }));
}
