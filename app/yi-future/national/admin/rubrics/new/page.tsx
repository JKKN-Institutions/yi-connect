import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { createRubric } from "@/app/yi-future/actions/rubrics";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";
import { DEFAULT_RUBRIC } from "@/lib/yi-future/constants";

async function getActiveEditionId(): Promise<string | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("editions")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export default async function NewRubricPage() {
  const editionId = await getActiveEditionId();
  if (!editionId) redirect("/yi-future/national/admin/editions");

  async function action(formData: FormData) {
    "use server";
    await createRubric(editionId!, formData);
  }

  const defaultJson = JSON.stringify(
    DEFAULT_RUBRIC.criteria.map((c) => ({
      key: c.key,
      label: c.label,
      max: c.max,
      description: c.description,
    })),
    null,
    2
  );

  return (
    <FormLayout
      title="New rubric"
      subtitle="Criteria are stored as JSON. The sum of 'max' values becomes total_max."
      backHref="/national/admin/rubrics"
    >
      <form action={action} className="space-y-5">
        <Field
          label="Name"
          name="name"
          required
          placeholder="Future 6.0 Chapter Final Rubric"
        />
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
            Scope *
          </label>
          <select
            name="scope"
            required
            defaultValue="chapter_final"
            className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
          >
            <option value="chapter_final">Chapter Final</option>
            <option value="national_semi">National Semi-Final</option>
            <option value="national_grand">National Grand Final</option>
            <option value="mock_jury">Mock Jury</option>
          </select>
        </div>
        <Field
          label="Threshold for national"
          name="threshold_for_national"
          type="number"
          placeholder="70"
          hint="Scores ≥ this advance to nationals (typical: 70/100)."
        />
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
            Criteria (JSON) *
          </label>
          <textarea
            name="criteria"
            required
            rows={14}
            defaultValue={defaultJson}
            className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm font-mono"
          />
          <p className="mt-1 text-xs text-navy/50">
            Array of {"{ key, label, max, description }"} objects.
          </p>
        </div>
        <SubmitRow
          submitLabel="Create rubric"
          cancelHref="/national/admin/rubrics"
        />
      </form>
    </FormLayout>
  );
}
