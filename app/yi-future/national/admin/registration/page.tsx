import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { isCurrentUserPlatformAdmin } from "@/app/yi-future/actions/national-admins";
import { saveRegistrationWindow } from "@/app/yi-future/actions/registration-window";
import { getRegistrationWindow } from "@/lib/yi-future/registration-window";
import { ActionResultForm } from "@/components/yi-future/admin/ActionResultForm";

type ChapterRow = { id: string; name: string; city: string };

async function getData() {
  const svc = await createServiceClient();

  const { data: edition } = await svc
    .schema("future")
    .from("editions")
    .select("id, name, slug")
    .eq("is_active", true)
    .maybeSingle();
  const ed = edition as { id: string; name: string; slug: string } | null;

  const { data: chapters } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, name, city")
    .eq("is_active", true)
    .order("name", { ascending: true });

  const window = ed ? await getRegistrationWindow(ed.id) : null;

  return {
    edition: ed,
    chapters: ((chapters as ChapterRow[] | null) ?? []),
    window,
  };
}

export default async function RegistrationWindowPage() {
  const [{ edition, chapters, window }, { isPlatform }] = await Promise.all([
    getData(),
    isCurrentUserPlatformAdmin(),
  ]);

  if (!edition || !window) {
    return (
      <div className="p-4 text-sm text-navy/60">
        No active edition found — activate an edition first.
      </div>
    );
  }

  async function saveAction(formData: FormData) {
    "use server";
    const closed = formData.get("closed") === "on";
    const ids = formData.getAll("open_chapter").map(String);
    return await saveRegistrationWindow(edition!.id, closed, ids);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy">Registration window</h2>
        <p className="mt-1 text-sm text-navy/60">
          Controls NEW delegate registrations on /yi-future/join for{" "}
          <strong>{edition.name}</strong>. Existing delegates can always sign
          in — this never locks anyone out.
        </p>
      </div>

      <div
        className={`rounded-md border p-3 text-sm font-semibold ${
          window.closedGlobally
            ? "bg-red-50 border-red-200 text-red-700"
            : "bg-yi-green/10 border-yi-green/30 text-yi-green"
        }`}
      >
        {window.closedGlobally
          ? window.openChapterIds.size === 0
            ? "Registrations are CLOSED for every chapter."
            : `Registrations are CLOSED — except ${window.openChapterIds.size} chapter${window.openChapterIds.size === 1 ? "" : "s"} kept open.`
          : "Registrations are OPEN for all chapters."}
      </div>

      {!isPlatform && (
        <div className="rounded-md border border-navy/15 bg-navy/5 px-4 py-3 text-xs text-navy/70">
          View only — only Platform admins can change the registration window.
        </div>
      )}

      {isPlatform && (
        <ActionResultForm
          action={saveAction}
          className="bg-white border border-navy/10 rounded-lg p-5 space-y-5"
        >
          <label className="flex items-start gap-3 p-3 rounded-md border-2 border-navy/15 cursor-pointer hover:border-[#F5A623]/60">
            <input
              type="checkbox"
              name="closed"
              defaultChecked={window.closedGlobally}
              className="accent-[#F5A623] h-5 w-5 mt-0.5"
            />
            <span>
              <span className="block text-sm font-bold text-navy">
                Close registrations
              </span>
              <span className="block text-xs text-navy/60 mt-0.5">
                When ticked, the join page only offers the chapters selected
                below. Untick to reopen everywhere (the list below is then
                ignored).
              </span>
            </span>
          </label>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-navy/60 mb-2">
              Chapters that stay OPEN while closed
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 max-h-96 overflow-y-auto border border-navy/10 rounded-md p-3">
              {chapters.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 text-sm text-navy p-1.5 rounded hover:bg-[#F5A623]/5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    name="open_chapter"
                    value={c.id}
                    defaultChecked={window.openChapterIds.has(c.id)}
                    className="accent-[#F5A623] h-4 w-4"
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
            >
              Save
            </button>
          </div>
        </ActionResultForm>
      )}
    </div>
  );
}
