"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-ivory flex items-center justify-center px-4">
      <div className="max-w-lg text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-3xl font-bold text-navy">Something went wrong</h1>
        <p className="mt-3 text-sm text-navy/60">
          This page hit an unexpected error. You can try again, or go back to
          the home page.
        </p>
        {error.digest && (
          <div className="mt-4 text-[10px] font-mono text-navy/40">
            Reference: {error.digest}
          </div>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-md border border-navy/20 text-navy/70 text-sm font-semibold hover:border-navy/40"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
