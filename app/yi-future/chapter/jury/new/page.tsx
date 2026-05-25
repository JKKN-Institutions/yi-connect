import { redirect } from "next/navigation";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { createJury } from "@/app/yi-future/actions/jury";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";
import {
  JURY_ARCHETYPES,
  JURY_ARCHETYPE_LABELS,
} from "@/lib/yi-future/constants";

export default async function NewJuryPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  async function action(formData: FormData) {
    "use server";
    await createJury(
      {
        editionId: ctx!.editionId,
        scope: "chapter",
        eventId: null,
      },
      formData
    );
  }

  return (
    <FormLayout
      title="Add jury"
      subtitle="Jury use their 6-character access code to log in. Archetype diversity across a team is encouraged (policy + industry + senior Yi + academic)."
      backHref="/yi-future/chapter/jury"
    >
      <form action={action} className="space-y-5">
        <Field
          label="Full name"
          name="jury_name"
          required
          placeholder="Ms. Anjali Bhat"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Title"
            name="jury_title"
            placeholder="Principal Scientist"
          />
          <Field
            label="Organization"
            name="organization"
            placeholder="CSIR"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" name="email" type="email" />
          <Field label="Phone" name="phone" type="tel" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
            Archetype *
          </label>
          <select
            name="archetype"
            required
            defaultValue=""
            className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
          >
            <option value="" disabled>
              — pick —
            </option>
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
          placeholder="Short bio for delegates to see."
        />
        <SubmitRow submitLabel="Add jury" cancelHref="/yi-future/chapter/jury" />
      </form>
    </FormLayout>
  );
}
