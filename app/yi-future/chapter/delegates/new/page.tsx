import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { createDelegate } from "@/app/yi-future/actions/delegates";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

async function getColleges(
  chapterId: string
): Promise<{ id: string; name: string }[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("colleges")
    .select("id, name")
    .eq("chapter_id", chapterId)
    .order("name", { ascending: true });
  return (data as unknown as { id: string; name: string }[]) ?? [];
}

export default async function NewDelegatePage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const colleges = await getColleges(ctx.chapterId);

  async function action(formData: FormData) {
    "use server";
    await createDelegate(
      { chapterId: ctx!.chapterId, editionId: ctx!.editionId },
      formData
    );
  }

  return (
    <FormLayout
      title="Register delegate"
      subtitle={`Adds a student delegate to ${ctx.chapterName} for ${ctx.editionName}. A 6-character access code is generated automatically.`}
      backHref="/yi-future/chapter/delegates"
    >
      <form action={action} className="space-y-5">
        <Field
          label="Full name"
          name="full_name"
          required
          placeholder="Priya Sharma"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" name="email" type="email" />
          <Field label="Phone" name="phone" type="tel" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field
            label="Age"
            name="age"
            type="number"
            placeholder="20"
          />
          <Field
            label="Year of study"
            name="year_of_study"
            type="number"
            placeholder="3"
          />
          <Field label="Home state" name="home_state" placeholder="KA" />
        </div>
        <Field
          label="Course / Program"
          name="course"
          placeholder="B.E. Computer Science"
        />
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
            College
          </label>
          <select
            name="college_id"
            defaultValue=""
            className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
          >
            <option value="">— none / other —</option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {colleges.length === 0 && (
            <p className="mt-1 text-xs text-navy/50">
              No colleges registered yet. Add one from{" "}
              <a
                href="/yi-future/chapter/colleges"
                className="text-yi-gold font-semibold"
              >
                Colleges
              </a>{" "}
              first, or leave blank.
            </p>
          )}
        </div>
        <SubmitRow
          submitLabel="Register delegate"
          cancelHref="/yi-future/chapter/delegates"
        />
      </form>
    </FormLayout>
  );
}
