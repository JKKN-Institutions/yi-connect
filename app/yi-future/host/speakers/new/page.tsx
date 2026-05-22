import { redirect } from "next/navigation";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { createHostSpeaker } from "@/app/yi-future/actions/host-speakers";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

export default async function NewHostSpeakerPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/login");

  async function action(formData: FormData) {
    "use server";
    await createHostSpeaker(ctx!.editionId, formData);
  }

  return (
    <FormLayout
      title="Add speaker"
      subtitle={`Speaker for the ${ctx.editionName} National Track Final hosted by ${ctx.chapterName}.`}
      backHref="/host/speakers"
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
          rows={4}
          placeholder="Short bio for programme handouts and the live display."
        />
        <SubmitRow submitLabel="Add speaker" cancelHref="/host/speakers" />
      </form>
    </FormLayout>
  );
}
