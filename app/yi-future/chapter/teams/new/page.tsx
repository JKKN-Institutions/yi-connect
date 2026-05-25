import { redirect } from "next/navigation";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { FormLayout } from "@/components/yi-future/admin/FormLayout";
import { NewTeamForm } from "./NewTeamForm";

export default async function NewTeamPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  return (
    <FormLayout
      title="New team"
      subtitle={`Teams can be up to 5 delegates. Pick a captain and problem statement later.`}
      backHref="/yi-future/chapter/teams"
    >
      <NewTeamForm chapterId={ctx.chapterId} editionId={ctx.editionId} />
    </FormLayout>
  );
}
