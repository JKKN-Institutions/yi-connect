import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import { updateMyResume } from "@/app/yi-future/actions/me";

async function getMe(
  id: string
): Promise<{ resume_url: string | null; full_name: string } | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("delegates")
    .select("resume_url, full_name")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as {
    resume_url: string | null;
    full_name: string;
  }) ?? null;
}

export default async function MyResumePage() {
  const session = await readSession();
  if (!session || session.type !== "delegate") redirect("/yi-future/join");

  const me = await getMe(session.id);
  if (!me) redirect("/yi-future/me");

  async function action(formData: FormData) {
    "use server";
    await updateMyResume(formData);
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/yi-future/me"
          className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
        >
          ← Dashboard
        </Link>
        <h2 className="mt-1 text-2xl font-bold text-navy">Your resume</h2>
        <p className="mt-1 text-sm text-navy/60">
          Paste a public share link to your resume. Partners see this during
          opportunity interviews.
        </p>
      </div>

      <section className="bg-white border border-navy/10 rounded-lg p-5 space-y-4">
        {me.resume_url && (
          <div className="p-3 rounded-md bg-yi-gold/5 border border-yi-gold/30 text-sm">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-yi-gold mb-1">
              Current resume
            </div>
            <a
              href={me.resume_url}
              target="_blank"
              rel="noopener"
              className="text-navy font-mono text-xs break-all hover:underline"
            >
              {me.resume_url}
            </a>
          </div>
        )}

        <form action={action} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
              Resume URL
            </label>
            <input
              type="url"
              name="resume_url"
              defaultValue={me.resume_url ?? ""}
              placeholder="https://drive.google.com/file/d/…"
              className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm font-mono"
            />
            <p className="mt-1 text-xs text-navy/50">
              Google Drive, Dropbox, LinkedIn — anything publicly viewable.
            </p>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
            >
              Save
            </button>
          </div>
        </form>
      </section>

      <p className="text-xs text-navy/40">
        Only delegates whose teams advance to nationals have their resumes
        surfaced to partners.
      </p>
    </div>
  );
}
