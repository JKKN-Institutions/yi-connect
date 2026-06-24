import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { AdminShellNav } from "./admin-shell-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/yip/login");
  }

  const gate = await requireSuperAdmin();
  if (!gate.ok) {
    return <Forbidden403 reason="The YIP admin area is restricted to national / super-admins." />;
  }

  return (
    // md+: nav sidebar beside content; mobile: nav (horizontal scroller) stacks on top.
    <div className="flex flex-col md:flex-row md:items-start">
      <AdminShellNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
