import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { createProblem } from "@/app/yi-future/actions/problems";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

export default async function NewProblemPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string }>;
}) {
  const { track: trackId } = await searchParams;
  if (!trackId) notFound();

  const svc = await createServiceClient();
  const { data: tr } = await svc
    .schema("future")
    .from("tracks")
    .select("id, name, slug")
    .eq("id", trackId)
    .maybeSingle();
  if (!tr) notFound();
  const track = tr as { id: string; name: string; slug: string };

  async function action(formData: FormData) {
    "use server";
    await createProblem(trackId!, formData);
  }

  return (
    <FormLayout
      title="New Problem Statement"
      subtitle={`Adding to ${track.name}`}
      backHref={`/national/admin/problems?track=${trackId}`}
    >
      <form action={action} className="space-y-5">
        <Field
          label="Title"
          name="title"
          required
          placeholder="Urban Heat Islands"
        />
        <Field
          label="Short description"
          name="short_description"
          as="textarea"
          rows={2}
          required
          placeholder="One or two sentences."
        />
        <Field
          label="Full description"
          name="full_description"
          as="textarea"
          rows={5}
          placeholder="Longer context for delegates."
        />
        <Field
          label="National priority context"
          name="national_priority_context"
          as="textarea"
          rows={2}
          placeholder="National Action Plan on Heat Waves · Mission LiFE"
          hint="Which national missions/programmes this aligns with."
        />
        <Field
          label="SDG alignment"
          name="sdg_alignment"
          placeholder="11, 13"
          hint="Comma-separated SDG numbers. Prefix 'SDG' will be added."
        />
        <Field
          label="Display order"
          name="display_order"
          type="number"
          placeholder="1"
        />
        <SubmitRow
          submitLabel="Create problem"
          cancelHref={`/national/admin/problems?track=${trackId}`}
        />
      </form>
    </FormLayout>
  );
}
