"use client";

import { useActionState } from "react";
import { loginCommittee, type LoginState } from "@/app/varnam-vizha/actions/auth";

const INITIAL: LoginState = { error: "" };

const inputCls =
  "w-full rounded-lg border border-[#3B0A45]/15 bg-white px-3 py-2.5 text-sm text-[#2B0A33] outline-none transition focus:border-[#D6336C] focus:ring-2 focus:ring-[#D6336C]/20";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginCommittee, INITIAL);
  return (
    <form action={action} className="space-y-3">
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        autoComplete="email"
        className={inputCls}
      />
      <input
        name="password"
        type="password"
        placeholder="Password"
        required
        autoComplete="current-password"
        className={inputCls}
      />
      {state.error && (
        <p className="text-sm font-medium text-[#D6336C]">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-[#3B0A45] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2B0A33] disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
