"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { signOutStudent } from "@/app/youth-academy/actions/student-auth";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await signOutStudent();
    } finally {
      router.push("/youth-academy/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10 disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <LogOut className="size-3.5" />
      )}
      Sign out
    </button>
  );
}
