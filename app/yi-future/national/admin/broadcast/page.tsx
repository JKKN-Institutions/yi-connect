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
  const { data } = await svc
    .schema("yi")
    .from("national_admins")
    .select("is_super_admin, is_platform_admin" as never)
    .eq("email", email)
    .maybeSingle<{ is_super_admin: boolean; is_platform_admin: boolean }>();

  const allowed = Boolean(data?.is_super_admin || data?.is_platform_admin);
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
