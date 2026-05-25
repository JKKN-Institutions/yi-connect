import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { updateHostSpeaker } from "@/app/yi-future/actions/host-speakers";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

type Speaker = {
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

async function getSpeaker(id: string): Promise<Speaker | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("experts")
    .select(
      "id, edition_id, full_name, title, organization, email, phone, bio, expertise_areas"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as Speaker) ?? null;
}

export default async function EditHostSpeakerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/login");

  const { id } = await params;
  const speaker = await getSpeaker(id);
  if (!speaker) notFound();
  if (speaker.edition_id !== ctx.editionId) {
    redirect("/yi-future/host/speakers");
  }

  async function action(formData: FormData) {
    "use server";
    await updateHostSpeaker(id, formData);
  }

  const expertiseDefault = speaker.expertise_areas?.join(", ") ?? "";

  return (
    <FormLayout
      title={`Edit — ${speaker.full_name}`}
      subtitle={speaker.organization ?? undefined}
      backHref="/yi-future/host/speakers"
    >
      <form action={action} className="space-y-5">
        <Field
          label="Full name"
          name="full_name"
          required
          defaultValue={speaker.full_name}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Title"
            name="title"
            defaultValue={speaker.title ?? ""}
          />
          <Field
            label="Organization"
            name="organization"
            defaultValue={speaker.organization ?? ""}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Email"
            name="email"
            type="email"
            defaultValue={speaker.email ?? ""}
          />
          <Field
            label="Phone"
            name="phone"
            type="tel"
            defaultValue={speaker.phone ?? ""}
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
          rows={4}
          defaultValue={speaker.bio ?? ""}
        />
        <SubmitRow submitLabel="Save changes" cancelHref="/yi-future/host/speakers" />
      </form>
    </FormLayout>
  );
}
