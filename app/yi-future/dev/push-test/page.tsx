import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { sendDevTestPush } from "@/app/yi-future/actions/dev-push";
import type { DevPushSubjectType } from "@/app/yi-future/actions/dev-push";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SubRow = {
  id: string;
  subject_type: string;
  subject_id: string;
  endpoint: string;
  user_agent: string | null;
  last_used_at: string | null;
};

async function loadAdminSubs(adminId: string): Promise<SubRow[]> {
  try {
    const svc = await createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc as any)
      .schema("future")
      .from("push_subscriptions")
      .select("id, subject_type, subject_id, endpoint, user_agent, last_used_at")
      .eq("subject_type", "auth_user")
      .eq("subject_id", adminId)
      .order("last_used_at", { ascending: false });
    return Array.isArray(data) ? (data as SubRow[]) : [];
  } catch {
    return [];
  }
}

async function loadSubsForSubject(
  subjectType: string,
  subjectId: string
): Promise<SubRow[]> {
  try {
    const svc = await createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc as any)
      .schema("future")
      .from("push_subscriptions")
      .select("id, subject_type, subject_id, endpoint, user_agent, last_used_at")
      .eq("subject_type", subjectType)
      .eq("subject_id", subjectId)
      .order("last_used_at", { ascending: false });
    return Array.isArray(data) ? (data as SubRow[]) : [];
  } catch {
    return [];
  }
}

type SearchParams = {
  ok?: string;
  sent?: string;
  failed?: string;
  removed?: string;
  error?: string;
  lastType?: string;
  lastId?: string;
};

export default async function DevPushTestPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user ?? null;

  if (!user) {
    return (
      <main className="min-h-screen bg-[#FFF8EC] text-[#0B1F3A]">
        <div className="mx-auto max-w-2xl px-6 py-16">
          <div className="rounded-lg border-2 border-[#0B1F3A] bg-[#0B1F3A] p-6 text-[#FFF8EC] shadow-lg">
            <h1 className="text-xl font-bold">Admin login required</h1>
            <p className="mt-2 text-sm opacity-90">
              The dev push-test tool is restricted to Supabase Auth admins.
              Access-code sessions (delegate/mentor/jury/partner) cannot use
              this page.
            </p>
            <Link
              href="/yi-future/login"
              className="mt-4 inline-block rounded bg-[#D4A017] px-4 py-2 text-sm font-semibold text-[#0B1F3A] hover:bg-[#E8B627]"
            >
              Go to /login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const ownSubs = await loadAdminSubs(user.id);

  // If we just sent, show the subs that were targeted.
  const lastTargetSubs =
    sp.lastType && sp.lastId
      ? await loadSubsForSubject(sp.lastType, sp.lastId)
      : [];

  // Server action bound to this page via form POST.
  async function handleSend(formData: FormData) {
    "use server";
    const subjectType = String(
      formData.get("subjectType") ?? ""
    ) as DevPushSubjectType;
    const subjectId = String(formData.get("subjectId") ?? "");
    const title = String(formData.get("title") ?? "");
    const body = String(formData.get("body") ?? "");
    const url = String(formData.get("url") ?? "") || undefined;

    const result = await sendDevTestPush({
      subjectType,
      subjectId,
      title,
      body,
      url,
    });

    const params = new URLSearchParams();
    params.set("lastType", subjectType);
    params.set("lastId", subjectId);
    if (result.ok) {
      params.set("ok", "1");
      params.set("sent", String(result.sent));
      params.set("failed", String(result.failed));
      params.set("removed", String(result.removed));
    } else {
      params.set("ok", "0");
      params.set("error", result.error);
    }
    redirect(`/dev/push-test?${params.toString()}`);
  }

  const defaultTitle = "Test push from Future 6.0";
  const defaultBody =
    "If you see this on your phone, PWA push is working ✓";

  return (
    <main className="min-h-screen bg-[#FFF8EC] text-[#0B1F3A]">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-8 border-b-2 border-[#D4A017] pb-4">
          <p className="text-xs uppercase tracking-widest text-[#D4A017]">
            Dev tool
          </p>
          <h1 className="mt-1 text-2xl font-bold">Push notification test</h1>
          <p className="mt-2 text-sm text-[#0B1F3A]/80">
            Manually trigger a web-push to any subject to verify the PWA flow
            on real devices. The recipient must have subscribed via the push
            button on <code>/me</code> first.
          </p>
        </header>

        {sp.ok === "1" && (
          <div className="mb-6 rounded-lg border-2 border-[#0B1F3A] bg-[#FFF8EC] p-4 shadow-sm">
            <p className="font-semibold">Push dispatched.</p>
            <p className="mt-1 text-sm">
              sent: <span className="font-mono">{sp.sent}</span> · failed:{" "}
              <span className="font-mono">{sp.failed}</span> · removed dead:{" "}
              <span className="font-mono">{sp.removed}</span>
            </p>
            {Number(sp.sent) === 0 && (
              <p className="mt-2 text-xs text-[#0B1F3A]/70">
                0 devices received it — check the subject has subscribed
                (list below), and that VAPID keys are configured in env.
              </p>
            )}
          </div>
        )}

        {sp.ok === "0" && (
          <div className="mb-6 rounded-lg border-2 border-red-600 bg-red-50 p-4 text-red-900 shadow-sm">
            <p className="font-semibold">Error</p>
            <p className="mt-1 font-mono text-sm">{sp.error}</p>
          </div>
        )}

        <section className="mb-6 rounded-lg border border-[#0B1F3A]/20 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#0B1F3A]/70">
            Logged-in admin
          </h2>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="font-medium">Email:</dt>
              <dd className="font-mono">{user.email ?? "(none)"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium">auth_user id:</dt>
              <dd className="select-all font-mono text-xs">{user.id}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-[#0B1F3A]/60">
            Tip: if you subscribed to push on <code>/me</code> as this admin,
            paste the id above with subjectType <code>auth_user</code>.
          </p>
        </section>

        <section className="mb-6 rounded-lg border border-[#0B1F3A]/20 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#0B1F3A]/70">
            Your push subscriptions (subject_type = auth_user)
          </h2>
          {ownSubs.length === 0 ? (
            <p className="mt-2 text-sm text-[#0B1F3A]/70">
              No subscriptions found for your admin id. Visit <code>/me</code>{" "}
              on the target device and tap the push-subscribe button first.
            </p>
          ) : (
            <ul className="mt-2 space-y-2 text-xs">
              {ownSubs.map((s) => (
                <li
                  key={s.id}
                  className="rounded border border-[#0B1F3A]/10 bg-[#FFF8EC] p-2"
                >
                  <div className="truncate font-mono">
                    {s.endpoint.slice(0, 80)}
                    {s.endpoint.length > 80 ? "…" : ""}
                  </div>
                  <div className="mt-1 text-[#0B1F3A]/60">
                    UA: {s.user_agent ?? "unknown"} · last used:{" "}
                    {s.last_used_at ?? "never"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-[#0B1F3A]/20 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#0B1F3A]/70">
            Send a test push
          </h2>

          <form action={handleSend} className="space-y-4">
            <div>
              <label
                htmlFor="subjectType"
                className="block text-xs font-semibold uppercase tracking-wide text-[#0B1F3A]/70"
              >
                Subject type
              </label>
              <select
                id="subjectType"
                name="subjectType"
                defaultValue={sp.lastType ?? "auth_user"}
                className="mt-1 w-full rounded border border-[#0B1F3A]/30 bg-white px-3 py-2 text-sm focus:border-[#D4A017] focus:outline-none"
              >
                <option value="auth_user">auth_user (admin)</option>
                <option value="delegate">delegate</option>
                <option value="mentor">mentor</option>
                <option value="jury">jury</option>
                <option value="partner">partner</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="subjectId"
                className="block text-xs font-semibold uppercase tracking-wide text-[#0B1F3A]/70"
              >
                Subject id (UUID)
              </label>
              <input
                id="subjectId"
                name="subjectId"
                type="text"
                required
                defaultValue={sp.lastId ?? user.id}
                placeholder="paste the delegate/mentor/jury/partner UUID"
                className="mt-1 w-full rounded border border-[#0B1F3A]/30 bg-white px-3 py-2 font-mono text-xs focus:border-[#D4A017] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="title"
                className="block text-xs font-semibold uppercase tracking-wide text-[#0B1F3A]/70"
              >
                Title
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                defaultValue={defaultTitle}
                className="mt-1 w-full rounded border border-[#0B1F3A]/30 bg-white px-3 py-2 text-sm focus:border-[#D4A017] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="body"
                className="block text-xs font-semibold uppercase tracking-wide text-[#0B1F3A]/70"
              >
                Body
              </label>
              <textarea
                id="body"
                name="body"
                required
                rows={3}
                defaultValue={defaultBody}
                className="mt-1 w-full rounded border border-[#0B1F3A]/30 bg-white px-3 py-2 text-sm focus:border-[#D4A017] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="url"
                className="block text-xs font-semibold uppercase tracking-wide text-[#0B1F3A]/70"
              >
                URL (opened on click)
              </label>
              <input
                id="url"
                name="url"
                type="text"
                defaultValue="/me"
                className="mt-1 w-full rounded border border-[#0B1F3A]/30 bg-white px-3 py-2 text-sm focus:border-[#D4A017] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="rounded bg-[#0B1F3A] px-4 py-2 text-sm font-semibold text-[#FFF8EC] hover:bg-[#0B1F3A]/90"
            >
              Send test push
            </button>
          </form>

          {lastTargetSubs.length > 0 && (
            <div className="mt-6 border-t border-[#0B1F3A]/10 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[#0B1F3A]/70">
                Subscriptions registered for {sp.lastType}:{sp.lastId}
              </h3>
              <ul className="mt-2 space-y-2 text-xs">
                {lastTargetSubs.map((s) => (
                  <li
                    key={s.id}
                    className="rounded border border-[#0B1F3A]/10 bg-[#FFF8EC] p-2"
                  >
                    <div className="truncate font-mono">
                      {s.endpoint.slice(0, 80)}
                      {s.endpoint.length > 80 ? "…" : ""}
                    </div>
                    <div className="mt-1 text-[#0B1F3A]/60">
                      UA: {s.user_agent ?? "unknown"} · last used:{" "}
                      {s.last_used_at ?? "never"}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-[#0B1F3A]/60">
                {lastTargetSubs.length} device
                {lastTargetSubs.length === 1 ? "" : "s"} registered for this
                subject.
              </p>
            </div>
          )}
        </section>

        <p className="mt-6 text-xs text-[#0B1F3A]/50">
          Route: <code>/dev/push-test</code> · admin-gated · does not expose
          any access-code session data.
        </p>
      </div>
    </main>
  );
}
