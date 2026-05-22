import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { createTrack } from "@/app/yi-future/actions/tracks";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";
import { notFound } from "next/navigation";

export default async function NewTrackPage({
  searchParams,
}: {
  searchParams: Promise<{ edition?: string }>;
}) {
  const { edition: editionId } = await searchParams;
  if (!editionId) notFound();

  const svc = await createServiceClient();
  const { data: ed } = await svc
    .schema("future")
    .from("editions")
    .select("id, name")
    .eq("id", editionId)
    .maybeSingle();
  if (!ed) notFound();
  const edition = ed as { id: string; name: string };

  async function action(formData: FormData) {
    "use server";
    await createTrack(editionId!, formData);
  }

  return (
    <FormLayout
      title="New Track"
      subtitle={`Adding to ${edition.name}`}
      backHref={`/national/admin/tracks?edition=${editionId}`}
    >
      <form action={action} className="space-y-5">
        <Field
          label="Slug"
          name="slug"
          required
          placeholder="climate_change"
          hint="Lowercase letters, digits, underscores."
        />
        <Field
          label="Name"
          name="name"
          required
          placeholder="Climate Change"
        />
        <Field
          label="Description"
          name="description"
          as="textarea"
          rows={3}
          placeholder="A short paragraph explaining what this track covers."
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Color hex"
            name="color_hex"
            placeholder="#138808"
            hint="With #, lowercase OK."
          />
          <Field
            label="Icon"
            name="icon"
            placeholder="🌱"
            hint="A single emoji or small string."
          />
        </div>
        <Field
          label="Display order"
          name="display_order"
          type="number"
          placeholder="1"
          hint="Lower numbers sort first."
        />
        <SubmitRow
          submitLabel="Create track"
          cancelHref={`/national/admin/tracks?edition=${editionId}`}
        />
      </form>
    </FormLayout>
  );
}
