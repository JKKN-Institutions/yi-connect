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

  // STRICT platform/super-tier gate (2026-06-01). yi_directory.role_assignments
  // is the source of truth. This page renders the broadcast form, whose
  // action (push.ts#broadcastPush → isSuperOrPlatform) is strict — so the
  // page gate MUST be strict too, or a regular admin sees a form the
  // action will reject. Two branches mirror isSuperOrPlatform:
  //   (a) cross-app platform-owner (platform_super_admin / super_admin on
  //       ANY app — lets director@jkkn.ac.in through); then
  //   (b) app='future' platform/super tier (regular future_admin /
  //       national_admin EXCLUDED).
  // Casts via `unknown` because yi_directory isn't in the future-pinned types.
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
    // (a) Cross-app platform-owner short-circuit — NO app filter.
    const svcDirPlatform = (svc as unknown as {
      schema: (s: string) => {
        from: (t: string) => {
          select: (c: string) => {
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
    }).schema("yi_directory");
    const { data: platformRows } = await svcDirPlatform
      .from("role_assignments")
      .select("role")
      .eq("person_id", person.id)
      .eq("is_active", true)
      .in("role", ["platform_super_admin", "super_admin"]);

    if ((platformRows ?? []).length > 0) {
      allowed = true;
    } else {
      // (b) app='future' platform/super tier (regular tier excluded).
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
        .in("role", [
          "future_super_admin",
          "platform_super_admin",
          "super_admin",
          "platform_admin",
        ]);
      allowed = (rows ?? []).length > 0;
    }
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
