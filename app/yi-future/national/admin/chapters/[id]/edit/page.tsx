import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { updateChapter } from "@/app/yi-future/actions/chapters";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

type Chapter = {
  id: string;
  name: string;
  city: string;
  state: string | null;
  region: string | null;
  logo_url: string | null;
};

async function getChapter(id: string): Promise<Chapter | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, name, city, state, region, logo_url")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as Chapter) ?? null;
}

export default async function EditChapterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const chapter = await getChapter(id);
  if (!chapter) notFound();

  async function action(formData: FormData) {
    "use server";
    await updateChapter(id, formData);
  }

  return (
    <FormLayout
      title={`Edit — ${chapter.name}`}
      backHref="/yi-future/national/admin/chapters"
    >
      <form action={action} className="space-y-5">
        <Field
          label="Chapter name"
          name="name"
          required
          defaultValue={chapter.name}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="City"
            name="city"
            required
            defaultValue={chapter.city}
          />
          <Field
            label="State"
            name="state"
            defaultValue={chapter.state ?? ""}
          />
        </div>
        <Field
          label="Region"
          name="region"
          defaultValue={chapter.region ?? ""}
        />
        <Field
          label="Logo URL"
          name="logo_url"
          defaultValue={chapter.logo_url ?? ""}
          hint="Optional — a square PNG works best."
        />
        <SubmitRow
          submitLabel="Save changes"
          cancelHref="/yi-future/national/admin/chapters"
        />
      </form>
    </FormLayout>
  );
}
