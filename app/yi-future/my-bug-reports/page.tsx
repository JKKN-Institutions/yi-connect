"use client";

import Link from "next/link";
import { MyBugsPanel } from "@boobalan_jkkn/bug-reporter-sdk";

// Step 6.5 of the wirefix recipe — Reporter Status View.
// Reuses the userContext already passed to BugReporterProvider in the
// root layout, so no extra wiring. Visible to anyone signed-in; the
// underlying API filters by reporter_email server-side.
export default function MyBugReportsPage() {
  return (
    <main className="min-h-screen bg-ivory">
      <div className="max-w-4xl mx-auto p-6 sm:p-10">
        <header className="mb-6">
          <Link
            href="/"
            className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
          >
            ← Back
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-navy">
            My Bug Reports
          </h1>
          <p className="mt-1 text-sm text-navy/60">
            Every issue you&apos;ve reported through the bug widget, with
            current status and resolution.
          </p>
        </header>
        <div className="bg-white border border-navy/10 rounded-lg p-4 sm:p-6">
          <MyBugsPanel />
        </div>
      </div>
    </main>
  );
}
