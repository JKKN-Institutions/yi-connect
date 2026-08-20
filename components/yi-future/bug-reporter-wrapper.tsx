"use client";

import { BugReporterProvider } from "@boobalan_jkkn/bug-reporter-sdk";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/yi-future/supabase/client";

type UserContext = {
  userId: string;
  name: string;
  email: string;
};

/**
 * Wraps the app in the JKKN Bug Reporter SDK.
 *
 * ─── SIGNED-IN ADMINS ONLY (Director, 2026-08-14) ──────────────────────────
 * The widget renders ONLY for a Supabase Auth user — chapter / national / host
 * admins. Everyone on an access code (delegate, mentor, jury, expert, partner,
 * volunteer) and every anonymous visitor gets no widget at all.
 *
 * WHY. A bug report sends a MANDATORY full-viewport screenshot to
 * jkkn-centralized-bug-reporter.vercel.app — JKKN infrastructure. Yi is a
 * separate organisation from JKKN. Delegates are minors, and the screens that
 * carry the most of their data are not their own: a jury or mentor screen shows
 * team rosters, full names, colleges and scores, and a half-filled /yi-future/join
 * form shows a name, email, phone and college being typed. Anonymising the
 * REPORTER (which is all v1 did for access-code roles) does nothing about any of
 * that, because the payload is the picture. YIP removed this widget outright for
 * the same reason on 2026-06-25; this is the same line drawn one role wider so
 * admins keep the channel.
 *
 * Gating on the Supabase session — rather than on a list of "student routes" —
 * is deliberate: a route list goes stale the moment someone adds a page, and
 * the failure mode of a stale list is a minor's screen leaving the org. This
 * fails CLOSED, including during the moment before auth resolves.
 *
 * The floating widget is suppressed (enabled=false) on /yi-future/my-bug-reports
 * because that page mounts its OWN BugReporterProvider (to guarantee the
 * MyBugsPanel context is initialised — see app/yi-future/my-bug-reports/page.tsx).
 * Disabling here keeps exactly one floating bug button on that route.
 */
export function BugReporterWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<UserContext | undefined>(undefined);
  const pathname = usePathname();

  const apiKey = process.env.NEXT_PUBLIC_BUG_REPORTER_API_KEY;
  const apiUrl = process.env.NEXT_PUBLIC_BUG_REPORTER_API_URL;

  // The My Bug Reports page provides its own widget + provider.
  const isMyBugReportsRoute =
    pathname?.startsWith("/yi-future/my-bug-reports") ?? false;

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

  // Not configured (e.g. local without keys) → render children, no widget.
  if (!apiKey || !apiUrl) {
    return <>{children}</>;
  }

  // No Supabase Auth user → no widget. This covers every access-code role
  // (delegate/mentor/jury/expert/partner/volunteer) and every anonymous
  // visitor, and it also covers the brief window before getUser() resolves,
  // so the button can never appear to someone who turns out not to be an admin.
  if (!user) {
    return <>{children}</>;
  }

  return (
    <BugReporterProvider
      apiKey={apiKey}
      apiUrl={apiUrl}
      enabled={!isMyBugReportsRoute}
      debug={process.env.NODE_ENV === "development"}
      userContext={user}
    >
      {children}
    </BugReporterProvider>
  );
}
