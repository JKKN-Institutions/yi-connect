import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { updateJury } from "@/app/yi-future/actions/jury";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";
import {
  JURY_ARCHETYPES,
  JURY_ARCHETYPE_LABELS,
} from "@/lib/yi-future/constants";
import type { Database } from "@/types/yi-future/database";

type Jury = {
  id: string;
  edition_id: string;
  jury_name: string;
  jury_title: string | null;
  organization: string | null;
  email: string | null;
  phone: string | null;
  bio: string | null;
  archetype: Database["future"]["Enums"]["jury_archetype"];
  access_code: string;
};

async function getJury(id: string): Promise<Jury | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("jury_assignments")
    .select(
      "id, edition_id, jury_name, jury_title, organization, email, phone, bio, archetype, access_code"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as Jury) ?? null;
}

export default async function EditJuryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  const { id } = await params;
  const jury = await getJury(id);
  if (!jury) notFound();
  if (jury.edition_id !== ctx.editionId) redirect("/yi-future/chapter/jury");

  async function action(formData: FormData) {
    "use server";
    await updateJury(id, formData);
  }

  return (
    <FormLayout
      title={`Edit — ${jury.jury_name}`}
      subtitle={`Access code: ${jury.access_code}`}
      backHref="/chapter/jury"
    >
      <form action={action} className="space-y-5">
        <Field
          label="Full name"
          name="jury_name"
          required
          defaultValue={jury.jury_name}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Title"
            name="jury_title"
            defaultValue={jury.jury_title ?? ""}
          />
          <Field
            label="Organization"
            name="organization"
            defaultValue={jury.organization ?? ""}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Email"
            name="email"
            type="email"
            defaultValue={jury.email ?? ""}
          />
          <Field
            label="Phone"
            name="phone"
            type="tel"
            defaultValue={jury.phone ?? ""}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
            Archetype *
          </label>
          <select
            name="archetype"
            required
            defaultValue={jury.archetype}
            className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
          >
            {JURY_ARCHETYPES.map((a) => (
              <option key={a} value={a}>
                {JURY_ARCHETYPE_LABELS[a]}
              </option>
            ))}
          </select>
        </div>
        <Field
          label="Bio"
          name="bio"
          as="textarea"
          rows={3}
          defaultValue={jury.bio ?? ""}
        />
        <SubmitRow submitLabel="Save changes" cancelHref="/chapter/jury" />
      </form>
    </FormLayout>
  );
}
