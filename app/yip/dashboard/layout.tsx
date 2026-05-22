import { redirect } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/server";
import { DashboardShell } from "./dashboard-shell";

export default async function DashboardLayout({
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
    <DashboardShell userEmail={user.email ?? "Organizer"}>
      {children}
    </DashboardShell>
  );
}
