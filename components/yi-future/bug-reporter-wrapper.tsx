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
 * - Reads the Supabase Auth user (chapter admin / national admin) when available
 * - Access-code roles (delegate/mentor/jury/partner) report anonymously for v1;
 *   server-side enrichment can attach role context in v2.
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
