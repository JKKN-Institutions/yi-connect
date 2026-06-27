import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Committee sign in" };

export default async function VarnamLoginPage() {
  const access = await getVarnamAccess();
  if (access.canView) redirect("/varnam-vizha/dashboard");

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16">
      <div className="w-full rounded-2xl border border-[#3B0A45]/10 bg-white p-8 shadow-sm">
        <h1 className="font-[family-name:var(--font-vv-display)] text-2xl font-bold text-[#3B0A45]">
          Committee sign in
        </h1>
        <p className="mb-6 mt-1 text-sm text-[#2B0A33]/60">
          For the Varnam Vizha organising committee.
        </p>
        <LoginForm />
      </div>
      <p className="mt-4 text-center text-xs text-[#2B0A33]/45">
        Uses your Yi Connect account. Not on the committee?{" "}
        <a
          href="mailto:erodevarnamvizha@gmail.com"
          className="font-medium text-[#0CA4A5] hover:underline"
        >
          Ask the chair
        </a>
        .
      </p>
    </div>
  );
}
