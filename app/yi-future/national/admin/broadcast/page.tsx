import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { BroadcastForm } from "./BroadcastForm";

export const metadata = {
  title: "Broadcast · Yi National · Yi Future 6.0",
};

/**
 * /national/admin/broadcast
 *
 * Super OR platform admins can send a web-push notification to every
 * subscribed Supabase Auth user (via yi.push_subscriptions). Other
 * national admins are bounced to the dashboard with an error code.
 */
export default async function BroadcastPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) redirect("/yi-future/login");

  const email = user.email.trim().toLowerCase();
  const svc = await createServiceClient();

  // Source-of-truth gate (2026-05-28): yi_directory.role_assignments
  // replaces the legacy yi.national_admins flag check. Two-step lookup
  // (people.id by email, then role_assignments) mirrors the inline
  // guard in app/yi-future/actions/push.ts#isSuperOrPlatform. Casts via
  // `unknown` because yi_directory isn't in the future-pinned types.
  const svcDir = (svc as unknown as {
    schema: (s: string) => {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: { id: string } | null }>;
          };
        };
      };
    };
  }).schema("yi_directory");
  const { data: person } = await svcDir
    .from("people")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  let allowed = false;
  if (person) {
    const svcDirRoles = (svc as unknown as {
      schema: (s: string) => {
        from: (t: string) => {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              eq: (k: string, v: string) => {
                eq: (k: string, v: boolean) => {
                  in: (
                    k: string,
                    v: string[]
                  ) => Promise<{ data: Array<{ role: string }> | null }>;
                };
              };
            };
          };
        };
      };
    }).schema("yi_directory");
    const { data: rows } = await svcDirRoles
      .from("role_assignments")
      .select("role")
      .eq("person_id", person.id)
      .eq("app", "future")
      .eq("is_active", true)
      .in("role", ["super_admin", "platform_admin", "national_admin"]);
    allowed = (rows ?? []).length > 0;
  }

  if (!allowed) {
    redirect("/yi-future/national/admin?error=not_super_or_platform");
  }

  // Subscriber count for the page header (best-effort).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (svc as any)
    .schema("yi")
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true });

  const subscriberCount = typeof count === "number" ? count : 0;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">
          Broadcast notification
        </h1>
        <p className="text-sm text-slate-600">
          Send a web-push notification to all admins who have enabled
          notifications. {subscriberCount}{" "}
          {subscriberCount === 1 ? "device" : "devices"} currently subscribed.
        </p>
      </header>

      <BroadcastForm />

      <aside className="rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 max-w-xl">
        <p className="font-medium text-slate-700 mb-1">Notes</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>
            Notifications go only to admins who clicked &ldquo;Enable
            notifications&rdquo; in their browser.
          </li>
          <li>Dead subscriptions (browser uninstalled) are pruned automatically.</li>
          <li>
            This action is restricted to super and platform admins. Standard
            national admins cannot broadcast.
          </li>
        </ul>
      </aside>
    </div>
  );
}
