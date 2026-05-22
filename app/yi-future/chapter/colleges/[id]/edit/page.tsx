import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { updateCollege } from "@/app/yi-future/actions/colleges";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

type College = {
  id: string;
  chapter_id: string | null;
  name: string;
  city: string | null;
  state: string | null;
  website_url: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  is_yuva: boolean | null;
};

async function getCollege(id: string): Promise<College | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("colleges")
    .select(
      "id, chapter_id, name, city, state, website_url, primary_contact_name, primary_contact_email, primary_contact_phone, is_yuva"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as College) ?? null;
}

export default async function EditCollegePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const { id } = await params;
  const college = await getCollege(id);
  if (!college) notFound();

  // Safety: only let admins of the owning chapter edit
  if (college.chapter_id && college.chapter_id !== ctx.chapterId) {
    redirect("/yi-future/chapter/colleges");
  }

  async function action(formData: FormData) {
    "use server";
    await updateCollege(id, formData);
  }

  return (
    <FormLayout
      title={`Edit — ${college.name}`}
      backHref="/chapter/colleges"
    >
      <form action={action} className="space-y-5">
        <Field
          label="College name"
          name="name"
          required
          defaultValue={college.name}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="City" name="city" defaultValue={college.city ?? ""} />
          <Field
            label="State"
            name="state"
            defaultValue={college.state ?? ""}
          />
        </div>
        <Field
          label="Website URL"
          name="website_url"
          type="url"
          defaultValue={college.website_url ?? ""}
        />

        <div className="pt-4 border-t border-navy/10">
          <div className="text-xs font-semibold uppercase tracking-widest text-navy/50 mb-3">
            Primary contact
          </div>
          <Field
            label="Contact name"
            name="primary_contact_name"
            defaultValue={college.primary_contact_name ?? ""}
          />
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Field
              label="Email"
              name="primary_contact_email"
              type="email"
              defaultValue={college.primary_contact_email ?? ""}
            />
            <Field
              label="Phone"
              name="primary_contact_phone"
              type="tel"
              defaultValue={college.primary_contact_phone ?? ""}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-navy">
          <input
            type="checkbox"
            name="is_yuva"
            defaultChecked={college.is_yuva ?? false}
            className="h-4 w-4 accent-yi-saffron"
          />
          <span>Yi YUVA partner college</span>
        </label>

        <SubmitRow submitLabel="Save changes" cancelHref="/chapter/colleges" />
      </form>
    </FormLayout>
  );
}
