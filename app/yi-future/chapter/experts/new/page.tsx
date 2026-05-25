import { redirect } from "next/navigation";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { createExpert } from "@/app/yi-future/actions/experts";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

export default async function NewExpertPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  async function action(formData: FormData) {
    "use server";
    await createExpert(ctx!.editionId, formData);
  }

  return (
    <FormLayout
      title="Add expert"
      subtitle={`Subject-matter expert for ${ctx.editionName}. Visible across chapters for expert talks and panels.`}
      backHref="/yi-future/chapter/experts"
    >
      <form action={action} className="space-y-5">
        <Field
          label="Full name"
          name="full_name"
          required
          placeholder="Dr. Anjali Rao"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Title"
            name="title"
            placeholder="Senior Policy Advisor"
          />
          <Field
            label="Organization"
            name="organization"
            placeholder="Observer Research Foundation"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" name="email" type="email" />
          <Field label="Phone" name="phone" type="tel" />
        </div>
        <Field
          label="Expertise areas"
          name="expertise_areas"
          placeholder="Urban policy, public health, road safety"
          hint="Comma-separated"
        />
        <Field
          label="Bio"
          name="bio"
          as="textarea"
          rows={3}
          placeholder="Short bio for programme handouts."
        />
        <SubmitRow submitLabel="Add expert" cancelHref="/yi-future/chapter/experts" />
      </form>
    </FormLayout>
  );
}
