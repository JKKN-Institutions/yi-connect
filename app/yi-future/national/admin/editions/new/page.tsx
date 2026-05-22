import { createEdition } from "@/app/yi-future/actions/editions";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

export default function NewEditionPage() {
  async function action(formData: FormData) {
    "use server";
    await createEdition(formData);
  }

  return (
    <FormLayout
      title="New Edition"
      subtitle="Create a new yearly cycle. The edition starts in the announcement stage and is inactive until you activate it."
      backHref="/national/admin/editions"
    >
      <form action={action} className="space-y-5">
        <Field
          label="Slug"
          name="slug"
          required
          placeholder="2027"
          hint="Must be a 4-digit year."
        />
        <Field
          label="Name"
          name="name"
          required
          placeholder="Future 7.0 — 2027"
        />
        <Field
          label="Tagline"
          name="tagline"
          placeholder="From Opinions to Impact"
        />
        <Field
          label="Kickoff date"
          name="kickoff_date"
          type="date"
          hint="When the 90-day journey formally begins."
        />
        <SubmitRow
          submitLabel="Create edition"
          cancelHref="/national/admin/editions"
        />
      </form>
    </FormLayout>
  );
}
