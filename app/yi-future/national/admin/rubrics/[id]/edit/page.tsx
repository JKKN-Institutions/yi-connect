import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { updateRubric } from "@/app/yi-future/actions/rubrics";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

type Criterion = {
  key: string;
  label: string;
  max: number;
  description?: string;
};

type Rubric = {
  id: string;
  name: string;
  scope: string;
  criteria: Criterion[];
  total_max: number | null;
  threshold_for_national: number | null;
};

async function getRubric(id: string): Promise<Rubric | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("rubrics")
    .select(
      "id, name, scope, criteria, total_max, threshold_for_national"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as Rubric) ?? null;
}

export default async function EditRubricPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rubric = await getRubric(id);
  if (!rubric) notFound();

  async function action(formData: FormData) {
    "use server";
    await updateRubric(id, formData);
  }

  const criteriaJson = JSON.stringify(rubric.criteria, null, 2);

  return (
    <FormLayout
      title={`Edit — ${rubric.name}`}
      subtitle={`Scope: ${rubric.scope} · Current total max: ${rubric.total_max}`}
      backHref="/yi-future/national/admin/rubrics"
    >
      <form action={action} className="space-y-5">
        <Field label="Name" name="name" required defaultValue={rubric.name} />
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
            Scope *
          </label>
          <select
            name="scope"
            required
            defaultValue={rubric.scope}
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
          defaultValue={String(rubric.threshold_for_national ?? "")}
        />
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
            Criteria (JSON) *
          </label>
          <textarea
            name="criteria"
            required
            rows={14}
            defaultValue={criteriaJson}
            className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm font-mono"
          />
        </div>
        <SubmitRow
          submitLabel="Save changes"
          cancelHref="/yi-future/national/admin/rubrics"
        />
      </form>
    </FormLayout>
  );
}
