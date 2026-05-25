"use client";

import { useState, useTransition } from "react";
import { createTeam } from "@/app/yi-future/actions/teams";
import { Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

export function NewTeamForm({
  chapterId,
  editionId,
}: {
  chapterId: string;
  editionId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createTeam({ chapterId, editionId }, formData);
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <Field
        label="Team name"
        name="team_name"
        required
        placeholder="The Climate Crew"
        hint="Must be unique across all chapters in this edition."
      />
      {error && (
        <p className="text-sm text-red-600 font-medium">{error}</p>
      )}
      <SubmitRow
        submitLabel={pending ? "Creating..." : "Create team"}
        cancelHref="/yi-future/chapter/teams"
      />
    </form>
  );
}
