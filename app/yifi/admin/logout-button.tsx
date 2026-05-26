"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { logoutOrganiser } from "@/app/yifi/actions/auth";

export function LogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => {
        startTransition(async () => {
          await logoutOrganiser();
          router.push("/yifi/login");
          router.refresh();
        });
      }}
      disabled={pending}
      className="text-xs text-white/40 hover:text-white/70 border border-white/10 hover:border-white/20 px-2.5 py-1 rounded-md transition-colors"
    >
      {pending ? "..." : "Sign Out"}
    </button>
  );
}
