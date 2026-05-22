import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { updateProblem } from "@/app/yi-future/actions/problems";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

type Problem = {
  id: string;
  track_id: string;
  title: string;
  short_description: string;
  full_description: string | null;
  national_priority_context: string | null;
  sdg_alignment: string[] | null;
  display_order: number | null;
};

async function getProblem(id: string): Promise<Problem | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("problem_statements")
    .select(
      "id, track_id, title, short_description, full_description, national_priority_context, sdg_alignment, display_order"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as Problem) ?? null;
}

export default async function EditProblemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const problem = await getProblem(id);
  if (!problem) notFound();

  async function action(formData: FormData) {
    "use server";
    await updateProblem(id, problem!.track_id, formData);
  }

  const sdgDefault = (problem.sdg_alignment ?? [])
    .map((s) => s.replace(/^SDG\s*/, ""))
    .join(", ");

  return (
    <FormLayout
      title={`Edit — ${problem.title}`}
      backHref={`/national/admin/problems?track=${problem.track_id}`}
    >
      <form action={action} className="space-y-5">
        <Field
          label="Title"
          name="title"
          required
          defaultValue={problem.title}
        />
        <Field
          label="Short description"
          name="short_description"
          as="textarea"
          rows={2}
          required
          defaultValue={problem.short_description}
        />
        <Field
          label="Full description"
          name="full_description"
          as="textarea"
          rows={5}
          defaultValue={problem.full_description ?? ""}
        />
        <Field
          label="National priority context"
          name="national_priority_context"
          as="textarea"
          rows={2}
          defaultValue={problem.national_priority_context ?? ""}
        />
        <Field
          label="SDG alignment"
          name="sdg_alignment"
          defaultValue={sdgDefault}
          hint="Comma-separated SDG numbers."
        />
        <Field
          label="Display order"
          name="display_order"
          type="number"
          defaultValue={String(problem.display_order ?? "")}
        />
        <SubmitRow
          submitLabel="Save changes"
          cancelHref={`/national/admin/problems?track=${problem.track_id}`}
        />
      </form>
    </FormLayout>
  );
}
