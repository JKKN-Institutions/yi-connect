import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { updateDelegate } from "@/app/yi-future/actions/delegates";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

type Delegate = {
  id: string;
  chapter_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  age: number | null;
  course: string | null;
  year_of_study: number | null;
  home_state: string | null;
  college_id: string | null;
  access_code: string;
};

async function getDelegate(id: string): Promise<Delegate | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("delegates")
    .select(
      "id, chapter_id, full_name, email, phone, age, course, year_of_study, home_state, college_id, access_code"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as Delegate) ?? null;
}

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

export default async function EditDelegatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const { id } = await params;
  const delegate = await getDelegate(id);
  if (!delegate) notFound();
  if (delegate.chapter_id !== ctx.chapterId) {
    redirect("/yi-future/chapter/delegates");
  }

  const colleges = await getColleges(ctx.chapterId);

  async function action(formData: FormData) {
    "use server";
    await updateDelegate(id, formData);
  }

  return (
    <FormLayout
      title={`Edit — ${delegate.full_name}`}
      subtitle={`Access code: ${delegate.access_code}`}
      backHref="/chapter/delegates"
    >
      <form action={action} className="space-y-5">
        <Field
          label="Full name"
          name="full_name"
          required
          defaultValue={delegate.full_name}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Email"
            name="email"
            type="email"
            defaultValue={delegate.email ?? ""}
          />
          <Field
            label="Phone"
            name="phone"
            type="tel"
            defaultValue={delegate.phone ?? ""}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field
            label="Age"
            name="age"
            type="number"
            defaultValue={String(delegate.age ?? "")}
          />
          <Field
            label="Year of study"
            name="year_of_study"
            type="number"
            defaultValue={String(delegate.year_of_study ?? "")}
          />
          <Field
            label="Home state"
            name="home_state"
            defaultValue={delegate.home_state ?? ""}
          />
        </div>
        <Field
          label="Course / Program"
          name="course"
          defaultValue={delegate.course ?? ""}
        />
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
            College
          </label>
          <select
            name="college_id"
            defaultValue={delegate.college_id ?? ""}
            className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
          >
            <option value="">— none / other —</option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <SubmitRow
          submitLabel="Save changes"
          cancelHref="/chapter/delegates"
        />
      </form>
    </FormLayout>
  );
}
