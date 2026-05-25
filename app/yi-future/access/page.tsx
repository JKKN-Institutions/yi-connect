"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProgramWordmark } from "@/components/yi-future/brand/BrandHeader";
import { CodeEntryStep } from "@/app/yi-future/join/steps/code-entry";

export default function AccessCodePage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-ivory flex flex-col">
      <header className="py-4 px-4 border-b border-navy/10 bg-white safe-top">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <ProgramWordmark />
          <Link
            href="/yi-future/login"
            className="text-xs text-navy/60 hover:text-navy font-medium"
          >
            Admin sign-in
          </Link>
        </div>
      </header>

      <section className="flex-1">
        <CodeEntryStep
          onBack={() => router.push("/yi-future/join")}
          onSuccess={(redirect) => {
            router.push(redirect);
            router.refresh();
          }}
        />
      </section>

      <footer className="border-t border-navy/10 py-6 px-4 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[11px] text-navy/40">
            Yi YUVA Future 6.0 · From Opinions to Impact
          </p>
          <p className="mt-2 text-xs text-navy/50">
            Don&apos;t have a code?{" "}
            <Link
              href="/yi-future/join"
              className="font-semibold text-navy hover:text-yi-gold"
            >
              Register here
            </Link>
          </p>
        </div>
      </footer>
    </main>
  );
}
