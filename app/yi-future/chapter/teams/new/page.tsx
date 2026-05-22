import { redirect } from "next/navigation";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { createTeam } from "@/app/yi-future/actions/teams";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

export default async function NewTeamPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  async function action(formData: FormData) {
    "use server";
    await createTeam(
      { chapterId: ctx!.chapterId, editionId: ctx!.editionId },
      formData
    );
  }

  return (
    <FormLayout
      title="New team"
      subtitle={`Teams are 3-5 delegates. Pick a captain and problem statement later.`}
      backHref="/chapter/teams"
    >
      <form action={action} className="space-y-5">
        <Field
          label="Team name"
          name="team_name"
          required
          placeholder="The Climate Crew"
          hint="Must be unique across all chapters in this edition."
        />
        <SubmitRow submitLabel="Create team" cancelHref="/chapter/teams" />
      </form>
    </FormLayout>
  );
}
