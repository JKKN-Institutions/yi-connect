import { redirect } from "next/navigation";
import { createClient } from "@/lib/yi-future/supabase/server";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const metadata = {
  title: "Change Password · Yi Future 6.0",
};

export default async function ChangePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-bold text-navy">Change password</h2>
      <p className="mt-2 text-sm text-navy/60">
        Update the password for{" "}
        <span className="font-semibold text-navy">{user.email}</span>. Use at
        least 10 characters. If you forget your password, contact your Yi
        National coordinator — there is no self-serve reset for v1.
      </p>

      <div className="mt-6 bg-white border border-navy/10 rounded-lg p-6">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
