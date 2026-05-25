"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { validateAccessCode } from "@/app/yifi/actions/auth";

export function JoinForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      const result = await validateAccessCode(code);
      if (result.type === "error") {
        setError(result.message);
        return;
      }
      router.push("/yifi/me");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. YIFI-A7K3"
          className="w-full px-4 py-3 text-lg text-center font-mono tracking-widest bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#FD7215] focus:border-transparent"
          maxLength={12}
          autoFocus
          autoComplete="off"
          disabled={isPending}
        />
      </div>

      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}

      <button
        type="submit"
        disabled={isPending || code.length < 3}
        className="w-full py-3 bg-[#FD7215] text-white font-semibold rounded-lg hover:bg-[#e5660f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? "Verifying..." : "Enter YiFi"}
      </button>
    </form>
  );
}
