// Registration open/close window for Future editions.
//
// Model: editions.registration_closed is the master switch. When it is TRUE,
// only chapters listed in future.registration_open_chapters (for that
// edition) may accept NEW delegate registrations. When FALSE, every active
// chapter is open. Existing delegates are never affected — this gates
// registration only, not sign-in.

import { createServiceClient } from "@/lib/yi-future/supabase/server";

export type RegistrationWindow = {
  editionId: string;
  closedGlobally: boolean;
  openChapterIds: Set<string>;
};

export async function getRegistrationWindow(
  editionId: string
): Promise<RegistrationWindow> {
  const svc = await createServiceClient();

  const { data: edition } = await svc
    .schema("future")
    .from("editions")
    .select("registration_closed" as never)
    .eq("id", editionId)
    .maybeSingle<{ registration_closed: boolean | null }>();

  // Fail OPEN here is deliberate: if the flag can't be read the platform
  // behaves as before this feature existed (all chapters open) rather than
  // blocking live registrations on a read hiccup.
  const closedGlobally = edition?.registration_closed === true;

  let openChapterIds = new Set<string>();
  if (closedGlobally) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows } = await (svc as any)
      .schema("future")
      .from("registration_open_chapters")
      .select("chapter_id")
      .eq("edition_id", editionId);
    openChapterIds = new Set(
      ((rows as { chapter_id: string }[] | null) ?? []).map((r) => r.chapter_id)
    );
  }

  return { editionId, closedGlobally, openChapterIds };
}

export function isChapterOpenForRegistration(
  window: RegistrationWindow,
  chapterId: string
): boolean {
  return !window.closedGlobally || window.openChapterIds.has(chapterId);
}
