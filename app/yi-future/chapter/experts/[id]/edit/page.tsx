import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { updateExpert } from "@/app/yi-future/actions/experts";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

type Expert = {
  id: string;
  edition_id: string;
  full_name: string;
  title: string | null;
  organization: string | null;
  email: string | null;
  phone: string | null;
  bio: string | null;
  expertise_areas: string[] | null;
};

async function getExpert(id: string): Promise<Expert | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("experts")
    .select(
      "id, edition_id, full_name, title, organization, email, phone, bio, expertise_areas"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as Expert) ?? null;
}

export default async function EditExpertPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const { id } = await params;
  const expert = await getExpert(id);
  if (!expert) notFound();
  if (expert.edition_id !== ctx.editionId) {
    redirect("/yi-future/chapter/experts");
  }

  async function action(formData: FormData) {
    "use server";
    await updateExpert(id, formData);
  }

  const expertiseDefault = expert.expertise_areas?.join(", ") ?? "";

  return (
    <FormLayout
      title={`Edit — ${expert.full_name}`}
      subtitle={expert.organization ?? undefined}
      backHref="/chapter/experts"
    >
      <form action={action} className="space-y-5">
        <Field
          label="Full name"
          name="full_name"
          required
          defaultValue={expert.full_name}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Title"
            name="title"
            defaultValue={expert.title ?? ""}
          />
          <Field
            label="Organization"
            name="organization"
            defaultValue={expert.organization ?? ""}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Email"
            name="email"
            type="email"
            defaultValue={expert.email ?? ""}
          />
          <Field
            label="Phone"
            name="phone"
            type="tel"
            defaultValue={expert.phone ?? ""}
          />
        </div>
        <Field
          label="Expertise areas"
          name="expertise_areas"
          defaultValue={expertiseDefault}
          hint="Comma-separated"
        />
        <Field
          label="Bio"
          name="bio"
          as="textarea"
          rows={3}
          defaultValue={expert.bio ?? ""}
        />
        <SubmitRow submitLabel="Save changes" cancelHref="/chapter/experts" />
      </form>
    </FormLayout>
  );
}
