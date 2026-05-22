import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { updateTrack } from "@/app/yi-future/actions/tracks";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

type Track = {
  id: string;
  edition_id: string;
  slug: string;
  name: string;
  description: string | null;
  color_hex: string | null;
  icon: string | null;
  display_order: number | null;
};

async function getTrack(id: string): Promise<Track | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("tracks")
    .select("id, edition_id, slug, name, description, color_hex, icon, display_order")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as Track) ?? null;
}

export default async function EditTrackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const track = await getTrack(id);
  if (!track) notFound();

  async function action(formData: FormData) {
    "use server";
    await updateTrack(id, track!.edition_id, formData);
  }

  return (
    <FormLayout
      title={`Edit — ${track.name}`}
      subtitle={`Slug: ${track.slug} · Edition id: ${track.edition_id}`}
      backHref={`/national/admin/tracks?edition=${track.edition_id}`}
    >
      <form action={action} className="space-y-5">
        <Field
          label="Name"
          name="name"
          required
          defaultValue={track.name}
        />
        <Field
          label="Description"
          name="description"
          as="textarea"
          rows={3}
          defaultValue={track.description ?? ""}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Color hex"
            name="color_hex"
            defaultValue={track.color_hex ?? ""}
          />
          <Field
            label="Icon"
            name="icon"
            defaultValue={track.icon ?? ""}
          />
        </div>
        <Field
          label="Display order"
          name="display_order"
          type="number"
          defaultValue={String(track.display_order ?? "")}
        />
        <SubmitRow
          submitLabel="Save changes"
          cancelHref={`/national/admin/tracks?edition=${track.edition_id}`}
        />
      </form>
    </FormLayout>
  );
}
