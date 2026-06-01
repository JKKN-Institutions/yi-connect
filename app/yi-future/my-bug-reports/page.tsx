"use client";

import Link from "next/link";
import { BugReporterProvider, MyBugsPanel } from "@boobalan_jkkn/bug-reporter-sdk";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/yi-future/supabase/client";

type UserContext = {
  userId: string;
  name: string;
  email: string;
};

// Reporter Status View, ported from the standalone YiFuture repo.
//
// IMPORTANT (2026-06-01 fix): this page no longer relies on inheriting the
// BugReporterProvider context from the yi-future layout's <BugReporterWrapper>.
// In production the layout-provided context reached <MyBugsPanel/> as an
// uninitialised value (apiClient === null), so the panel rendered the SDK
// error "Bug Reporter not initialized" even though the floating widget worked.
// We now wrap the panel in its OWN properly-initialised BugReporterProvider —
// the same self-contained Provider + MyBugsPanel pattern that already works in
// components/bug-reporter-wrapper.tsx (the dashboard "My Bugs" drawer). The
// layout suppresses its own widget on this route (see bug-reporter-wrapper.tsx)
// so there is exactly one floating button on the page.
//
// Visible to anyone signed-in; the underlying API filters by reporter_email
// server-side via the user context attached below.
export default function MyBugReportsPage() {
  const apiKey = process.env.NEXT_PUBLIC_BUG_REPORTER_API_KEY;
  const apiUrl = process.env.NEXT_PUBLIC_BUG_REPORTER_API_URL;

  const [user, setUser] = useState<UserContext | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();

    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({
          userId: data.user.id,
          name:
            (data.user.user_metadata?.full_name as string | undefined) ??
            data.user.email ??
            "Admin",
          email: data.user.email ?? "",
        });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          userId: session.user.id,
          name:
            (session.user.user_metadata?.full_name as string | undefined) ??
            session.user.email ??
            "Admin",
          email: session.user.email ?? "",
        });
      } else {
        setUser(undefined);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <main className="min-h-screen bg-ivory">
      <div className="max-w-4xl mx-auto p-6 sm:p-10">
        <header className="mb-6">
          <Link
            href="/yi-future"
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
          {!apiKey || !apiUrl ? (
            <p className="text-sm text-navy/60">
              Bug reporting is not configured in this environment.
            </p>
          ) : (
            <BugReporterProvider
              apiKey={apiKey}
              apiUrl={apiUrl}
              enabled={true}
              debug={process.env.NODE_ENV === "development"}
              userContext={user}
            >
              <MyBugsPanel />
            </BugReporterProvider>
          )}
        </div>
      </div>
    </main>
  );
}
