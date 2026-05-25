import { redirect } from "next/navigation";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { createMentor } from "@/app/yi-future/actions/mentors";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

export default async function NewMentorPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  async function action(formData: FormData) {
    "use server";
    await createMentor(
      { chapterId: ctx!.chapterId, editionId: ctx!.editionId },
      formData
    );
  }

  return (
    <FormLayout
      title="Add mentor"
      subtitle={`For ${ctx.chapterName}. A 6-character access code is generated automatically.`}
      backHref="/yi-future/chapter/mentors"
    >
      <form action={action} className="space-y-5">
        <Field
          label="Full name"
          name="full_name"
          required
          placeholder="Dr. Priya Menon"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Title"
            name="title"
            placeholder="Director of Policy"
          />
          <Field
            label="Organization"
            name="organization"
            placeholder="NITI Aayog"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" name="email" type="email" />
          <Field label="Phone" name="phone" type="tel" />
        </div>
        <Field
          label="Expertise"
          name="expertise"
          placeholder="Urban policy, public health"
          hint="Short description."
        />
        <Field
          label="Bio"
          name="bio"
          as="textarea"
          rows={3}
          placeholder="Short bio for delegates to see."
        />
        <SubmitRow submitLabel="Add mentor" cancelHref="/yi-future/chapter/mentors" />
      </form>
    </FormLayout>
  );
}
