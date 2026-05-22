import { createChapter } from "@/app/yi-future/actions/chapters";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

export default function NewChapterPage() {
  async function action(formData: FormData) {
    "use server";
    await createChapter(formData);
  }

  return (
    <FormLayout
      title="New Chapter"
      subtitle="Add a Yi chapter. Chapters persist across editions; active flag controls visibility."
      backHref="/national/admin/chapters"
    >
      <form action={action} className="space-y-5">
        <Field label="Chapter name" name="name" required placeholder="Bangalore" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="City" name="city" required placeholder="Bangalore" />
          <Field label="State" name="state" placeholder="KA" />
        </div>
        <Field
          label="Region"
          name="region"
          placeholder="SR"
          hint="Yi zone shorthand (NR/SR/ER/WR/NER/SRTN/SRTKKA)."
        />
        <SubmitRow
          submitLabel="Create chapter"
          cancelHref="/national/admin/chapters"
        />
      </form>
    </FormLayout>
  );
}
