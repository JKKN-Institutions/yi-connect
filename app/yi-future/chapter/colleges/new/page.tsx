import { redirect } from "next/navigation";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { createCollege } from "@/app/yi-future/actions/colleges";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

export default async function NewCollegePage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  async function action(formData: FormData) {
    "use server";
    await createCollege(ctx!.chapterId, formData);
  }

  return (
    <FormLayout
      title="Add college"
      subtitle={`For ${ctx.chapterName}`}
      backHref="/chapter/colleges"
    >
      <form action={action} className="space-y-5">
        <Field
          label="College name"
          name="name"
          required
          placeholder="RV College of Engineering"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="City" name="city" />
          <Field label="State" name="state" />
        </div>
        <Field
          label="Website URL"
          name="website_url"
          type="url"
          placeholder="https://rvce.edu.in"
        />

        <div className="pt-4 border-t border-navy/10">
          <div className="text-xs font-semibold uppercase tracking-widest text-navy/50 mb-3">
            Primary contact
          </div>
          <Field
            label="Contact name"
            name="primary_contact_name"
            placeholder="Dean, Student Affairs"
          />
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Field label="Email" name="primary_contact_email" type="email" />
            <Field label="Phone" name="primary_contact_phone" type="tel" />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-navy">
          <input
            type="checkbox"
            name="is_yuva"
            className="h-4 w-4 accent-yi-saffron"
          />
          <span>Yi YUVA partner college</span>
        </label>

        <SubmitRow submitLabel="Add college" cancelHref="/chapter/colleges" />
      </form>
    </FormLayout>
  );
}
