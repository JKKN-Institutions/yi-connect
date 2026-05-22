import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
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

  return (
    <div>
      <AdminShellNav />
      {children}
    </div>
  );
}
