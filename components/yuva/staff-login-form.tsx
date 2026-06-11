import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Email + password sign-in for Youth Academy staff (national / chapter /
 * institution / mentor) who don't use Google. A plain HTML form that POSTs to
 * the staff-login route handler — works without client JS, and the handler
 * flushes the Supabase session cookie reliably. Authorization is still
 * enforced downstream by the yuva-role gates.
 */
export function StaffLoginForm({
  redirectTo,
  error,
}: {
  redirectTo?: string;
  error?: string;
}) {
  return (
    <form
      method="POST"
      action="/youth-academy/api/staff-login"
      className="space-y-3"
    >
      <input
        type="hidden"
        name="redirectTo"
        value={redirectTo ?? "/youth-academy"}
      />
      <Input
        name="email"
        type="email"
        placeholder="you@organisation.com"
        autoComplete="email"
        aria-label="Email"
        required
      />
      <Input
        name="password"
        type="password"
        placeholder="Password"
        autoComplete="current-password"
        aria-label="Password"
        required
      />
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error === "missing"
            ? "Enter your email and password."
            : "Invalid email or password."}
        </p>
      )}
      <Button type="submit" className="w-full">
        Sign in with email
      </Button>
      <a
        href="/forgot-password"
        className="block text-center text-xs text-slate-500 hover:text-slate-800 hover:underline"
      >
        Forgot password?
      </a>
    </form>
  );
}
