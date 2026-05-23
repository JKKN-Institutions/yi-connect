"use client";

import { useRouter } from "next/navigation";
import { BrandStrip, ProgramWordmark } from "@/components/yi-future/brand/BrandHeader";
import { CodeEntryStep } from "@/app/yi-future/join/steps/code-entry";

export default function UnlockPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-ivory flex flex-col">
      <header className="py-4 px-4 border-b border-navy/10 bg-white safe-top">
        <div className="max-w-5xl mx-auto">
          <ProgramWordmark />
        </div>
      </header>

      <section className="flex-1 flex flex-col items-center justify-start px-4 py-8">
        <div className="w-full max-w-lg">
          <BrandStrip className="mb-4" />
          <h1 className="sr-only">Enter your access code</h1>
          <CodeEntryStep
            onBack={() => router.push("/yi-future")}
            onSuccess={(redirect) => {
              window.location.href = redirect;
            }}
          />
        </div>
      </section>

      <footer className="border-t border-navy/10 py-6 px-4 bg-white">
        <BrandStrip />
      </footer>
    </main>
  );
}
