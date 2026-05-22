import type { Metadata } from "next";
import { JoinHeader } from "@/components/yi-future/brand/JoinHeader";
import { RetryButton } from "./RetryButton";

export const metadata: Metadata = {
  title: "Offline",
  description: "You're offline. Reconnect and try again.",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-ivory flex flex-col">
      <header className="px-4 border-b border-navy/10 bg-white">
        <div className="max-w-5xl mx-auto">
          <JoinHeader />
        </div>
      </header>

      <section className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-yi-gold">
            No connection
          </p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-black text-navy leading-tight">
            You&rsquo;re offline
          </h1>
          <p className="mt-4 text-base text-navy/70 leading-relaxed">
            Some features need an internet connection. Tap retry once
            you&rsquo;re back online.
          </p>
          <div className="mt-8">
            <RetryButton />
          </div>
        </div>
      </section>
    </main>
  );
}
