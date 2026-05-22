import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { updateMentor } from "@/app/yi-future/actions/mentors";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

type Mentor = {
  id: string;
  chapter_id: string | null;
  full_name: string;
  title: string | null;
  organization: string | null;
  email: string | null;
  phone: string | null;
  expertise: string | null;
  bio: string | null;
  access_code: string;
};

async function getMentor(id: string): Promise<Mentor | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("mentors")
    .select(
      "id, chapter_id, full_name, title, organization, email, phone, expertise, bio, access_code"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as Mentor) ?? null;
}

export default async function EditMentorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const { id } = await params;
  const mentor = await getMentor(id);
  if (!mentor) notFound();
  if (mentor.chapter_id && mentor.chapter_id !== ctx.chapterId) {
    redirect("/yi-future/chapter/mentors");
  }

  async function action(formData: FormData) {
    "use server";
    await updateMentor(id, formData);
  }

  return (
    <FormLayout
      title={`Edit — ${mentor.full_name}`}
      subtitle={`Access code: ${mentor.access_code}`}
      backHref="/chapter/mentors"
    >
      <form action={action} className="space-y-5">
        <Field
          label="Full name"
          name="full_name"
          required
          defaultValue={mentor.full_name}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Title"
            name="title"
            defaultValue={mentor.title ?? ""}
          />
          <Field
            label="Organization"
            name="organization"
            defaultValue={mentor.organization ?? ""}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Email"
            name="email"
            type="email"
            defaultValue={mentor.email ?? ""}
          />
          <Field
            label="Phone"
            name="phone"
            type="tel"
            defaultValue={mentor.phone ?? ""}
          />
        </div>
        <Field
          label="Expertise"
          name="expertise"
          defaultValue={mentor.expertise ?? ""}
        />
        <Field
          label="Bio"
          name="bio"
          as="textarea"
          rows={3}
          defaultValue={mentor.bio ?? ""}
        />
        <SubmitRow submitLabel="Save changes" cancelHref="/chapter/mentors" />
      </form>
    </FormLayout>
  );
}
