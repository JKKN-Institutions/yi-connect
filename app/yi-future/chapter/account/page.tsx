import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/yi-future/supabase/server";

export const metadata = {
  title: "Account Settings · Yi Future 6.0",
};

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy">Account Settings</h2>
        <p className="mt-2 text-sm text-navy/60">
          Signed in as{" "}
          <span className="font-semibold text-navy">{user.email}</span>.
        </p>
      </div>

      <Link
        href="/yi-future/chapter/account/password"
        className="block bg-white border border-navy/10 rounded-lg p-6 hover:border-yi-gold/50 hover:shadow-sm transition-all"
      >
        <div className="text-xs font-semibold uppercase tracking-widest text-navy/50">
          Security
        </div>
        <div className="mt-1 text-base font-bold text-navy">
          Change password
        </div>
        <p className="mt-1 text-sm text-navy/60">
          Update the password used to sign in to Yi Future.
        </p>
      </Link>
    </div>
  );
}
