import Link from "next/link";
import { redirect } from "next/navigation";
import { getYiqSession } from "@/lib/yiq/auth/yiq-session";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function YiqLoginPage() {
  const session = await getYiqSession();
  if (session?.type === "student") redirect("/yiq/me");

  return (
    <main
      id="yiq-main"
      className="flex min-h-screen flex-col"
      style={{ background: "#0a1633", color: "#f7f4ed" }}
    >
      <header className="mx-auto w-full max-w-md px-5 py-5">
        <Link href="/yiq" className="yiq-display text-[1.375rem]">
          YIQ
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-16">
        <h1 className="yiq-display text-[2.5rem]">Sign in</h1>
        <p className="mt-3 text-[0.9375rem]" style={{ color: "#9fb0d4" }}>
          Enter the access code from your registration slip. Each student has
          their own code — don&apos;t use a teammate&apos;s.
        </p>
        <LoginForm />
        <p className="mt-8 text-[0.875rem]" style={{ color: "#9fb0d4" }}>
          No code yet?{" "}
          <Link href="/yiq/register" className="underline" style={{ color: "#e8a33d" }}>
            Register your school team
          </Link>
        </p>
      </div>
    </main>
  );
}
