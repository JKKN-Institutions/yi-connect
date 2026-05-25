import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { updateEdition } from "@/app/yi-future/actions/editions";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

type EditionRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  kickoff_date: string | null;
  chapter_final_window_start: string | null;
  chapter_final_window_end: string | null;
  national_finals_window_start: string | null;
  national_finals_window_end: string | null;
  finale_visibility_cutoff: string | null;
};

async function getEdition(id: string): Promise<EditionRow | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("editions")
    .select(
      "id, slug, name, tagline, kickoff_date, chapter_final_window_start, chapter_final_window_end, national_finals_window_start, national_finals_window_end, finale_visibility_cutoff"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as EditionRow) ?? null;
}

/**
 * Convert a TIMESTAMPTZ ISO string to a value compatible with
 * `<input type="datetime-local">` (yyyy-MM-ddTHH:mm, in local time).
 * Returns "" if the input is null/invalid.
 */
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditEditionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const edition = await getEdition(id);
  if (!edition) notFound();

  async function action(formData: FormData) {
    "use server";
    await updateEdition(id, formData);
  }

  return (
    <FormLayout
      title={`Edit — ${edition.name}`}
      subtitle={`Slug: ${edition.slug}`}
      backHref="/yi-future/national/admin/editions"
    >
      <form action={action} className="space-y-5">
        <Field label="Name" name="name" required defaultValue={edition.name} />
        <Field
          label="Tagline"
          name="tagline"
          defaultValue={edition.tagline ?? ""}
        />
        <Field
          label="Kickoff date"
          name="kickoff_date"
          type="date"
          defaultValue={edition.kickoff_date ?? ""}
        />

        <div className="pt-4 border-t border-navy/10">
          <div className="text-xs font-semibold uppercase tracking-widest text-navy/50 mb-3">
            Chapter Final window
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Start"
              name="chapter_final_window_start"
              type="date"
              defaultValue={edition.chapter_final_window_start ?? ""}
            />
            <Field
              label="End"
              name="chapter_final_window_end"
              type="date"
              defaultValue={edition.chapter_final_window_end ?? ""}
            />
          </div>
        </div>

        <div className="pt-4 border-t border-navy/10">
          <div className="text-xs font-semibold uppercase tracking-widest text-navy/50 mb-3">
            National Finals window
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Start"
              name="national_finals_window_start"
              type="date"
              defaultValue={edition.national_finals_window_start ?? ""}
            />
            <Field
              label="End"
              name="national_finals_window_end"
              type="date"
              defaultValue={edition.national_finals_window_end ?? ""}
            />
          </div>
        </div>

        <div className="pt-4 border-t border-navy/10">
          <div className="text-xs font-semibold uppercase tracking-widest text-navy/50 mb-3">
            Finale visibility
          </div>
          <Field
            label="Finale visibility cutoff"
            name="finale_visibility_cutoff"
            type="datetime-local"
            defaultValue={toDatetimeLocal(edition.finale_visibility_cutoff)}
            hint="Finale chapter admins can see other chapters' rankings + submissions only AFTER this date."
          />
        </div>

        <SubmitRow
          submitLabel="Save changes"
          cancelHref="/yi-future/national/admin/editions"
        />
      </form>
    </FormLayout>
  );
}
