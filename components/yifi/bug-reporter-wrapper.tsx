"use client";

import { BugReporterProvider } from "@boobalan_jkkn/bug-reporter-sdk";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/yifi/supabase/client";

type UserContext = {
  userId: string;
  name: string;
  email: string;
};

/**
 * Mounts the JKKN Bug Reporter widget across the /yifi app.
 *
 * - Reads the Supabase Auth user (organiser / admin) when available and
 *   attaches it as report context.
 * - Registrants who enter via an access code have no Supabase session — they
 *   report anonymously (userContext undefined).
 *
 * Mirrors components/yi-future/bug-reporter-wrapper.tsx (per-app wrapper
 * pattern; shared NEXT_PUBLIC_BUG_REPORTER_* key for the whole monorepo).
 */
export function YifiBugReporterWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<UserContext | undefined>(undefined);

  const apiKey = process.env.NEXT_PUBLIC_BUG_REPORTER_API_KEY;
  const apiUrl = process.env.NEXT_PUBLIC_BUG_REPORTER_API_URL;

  useEffect(() => {
    const supabase = createClient();

    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({
          userId: data.user.id,
          name:
            (data.user.user_metadata?.full_name as string | undefined) ??
            data.user.email ??
            "Organiser",
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
            "Organiser",
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
      enabled={true}
      debug={process.env.NODE_ENV === "development"}
      userContext={user}
    >
      {children}
    </BugReporterProvider>
  );
}
